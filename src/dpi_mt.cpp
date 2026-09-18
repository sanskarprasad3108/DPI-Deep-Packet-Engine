// Multi-threaded DPI Engine v2.0 with Real-Time Telemetry Streaming
// Architecture: Reader -> LB threads -> FP threads -> Output Writer

#include <iostream>
#include <fstream>
#include <thread>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <memory>
#include <chrono>
#include <iomanip>
#include <algorithm>
#include <optional>
#include <sstream>

#include "pcap_reader.h"
#include "packet_parser.h"
#include "sni_extractor.h"
#include "types.h"
#include "telemetry_collector.h"

using namespace PacketAnalyzer;
using namespace DPI;

// Helper: Convert uint32_t IP to string
static std::string ipUintToString(uint32_t ip) {
    std::ostringstream ss;
    ss << (ip & 0xFF) << "."
       << ((ip >> 8) & 0xFF) << "."
       << ((ip >> 16) & 0xFF) << "."
       << ((ip >> 24) & 0xFF);
    return ss.str();
}

// =============================================================================
// Thread-Safe Queue
// =============================================================================
template<typename T>
class TSQueue {
public:
    TSQueue(size_t max_size = 10000) : max_size_(max_size), shutdown_(false) {}
    
    void push(T item) {
        std::unique_lock<std::mutex> lock(mutex_);
        not_full_.wait(lock, [this] { return queue_.size() < max_size_ || shutdown_; });
        if (shutdown_) return;
        queue_.push(std::move(item));
        not_empty_.notify_one();
    }
    
    std::optional<T> pop(int timeout_ms = 100) {
        std::unique_lock<std::mutex> lock(mutex_);
        if (!not_empty_.wait_for(lock, std::chrono::milliseconds(timeout_ms),
                                  [this] { return !queue_.empty() || shutdown_; })) {
            return std::nullopt;
        }
        if (queue_.empty()) return std::nullopt;
        T item = std::move(queue_.front());
        queue_.pop();
        not_full_.notify_one();
        return item;
    }
    
    void shutdown() {
        std::lock_guard<std::mutex> lock(mutex_);
        shutdown_ = true;
        not_empty_.notify_all();
        not_full_.notify_all();
    }
    
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.size();
    }
    
    bool is_shutdown() const { return shutdown_; }

private:
    std::queue<T> queue_;
    mutable std::mutex mutex_;
    std::condition_variable not_empty_;
    std::condition_variable not_full_;
    size_t max_size_;
    std::atomic<bool> shutdown_;
};

// =============================================================================
// Packet Job
// =============================================================================
struct Packet {
    uint32_t id;
    uint32_t ts_sec;
    uint32_t ts_usec;
    FiveTuple tuple;
    std::vector<uint8_t> data;
    uint8_t tcp_flags;
    size_t payload_offset;
    size_t payload_length;
};

// =============================================================================
// Flow Entry
// =============================================================================
struct FlowEntry {
    FiveTuple tuple;
    AppType app_type = AppType::UNKNOWN;
    std::string sni;
    uint64_t packets = 0;
    uint64_t bytes = 0;
    bool blocked = false;
    bool classified = false;
    std::string block_reason;
    std::vector<std::string> journey_steps;
    uint64_t created_at_ms = 0;
    uint64_t last_seen_ms = 0;
    bool syn_seen = false;
    bool syn_ack_seen = false;
    bool fin_seen = false;
};

// =============================================================================
// Blocking Rules
// =============================================================================
class Rules {
public:
    void blockIP(const std::string& ip) {
        std::lock_guard<std::mutex> lock(mutex_);
        blocked_ips_.insert(parseIP(ip));
        std::cout << "[Rules] Blocked IP: " << ip << "\n";
    }
    
    void unblockIP(const std::string& ip) {
        std::lock_guard<std::mutex> lock(mutex_);
        blocked_ips_.erase(parseIP(ip));
        std::cout << "[Rules] Unblocked IP: " << ip << "\n";
    }
    
    void blockApp(const std::string& app) {
        std::lock_guard<std::mutex> lock(mutex_);
        for (int i = 0; i < static_cast<int>(AppType::APP_COUNT); i++) {
            if (appTypeToString(static_cast<AppType>(i)) == app) {
                blocked_apps_.insert(static_cast<AppType>(i));
                std::cout << "[Rules] Blocked app: " << app << "\n";
                return;
            }
        }
        std::cerr << "[Rules] Unknown app: " << app << "\n";
    }
    
    void unblockApp(const std::string& app) {
        std::lock_guard<std::mutex> lock(mutex_);
        for (int i = 0; i < static_cast<int>(AppType::APP_COUNT); i++) {
            if (appTypeToString(static_cast<AppType>(i)) == app) {
                blocked_apps_.erase(static_cast<AppType>(i));
                std::cout << "[Rules] Unblocked app: " << app << "\n";
                return;
            }
        }
    }
    
    void blockDomain(const std::string& domain) {
        std::lock_guard<std::mutex> lock(mutex_);
        blocked_domains_.push_back(domain);
        std::cout << "[Rules] Blocked domain: " << domain << "\n";
    }
    
    void unblockDomain(const std::string& domain) {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = std::find(blocked_domains_.begin(), blocked_domains_.end(), domain);
        if (it != blocked_domains_.end()) {
            blocked_domains_.erase(it);
            std::cout << "[Rules] Unblocked domain: " << domain << "\n";
        }
    }
    
    struct BlockResult {
        bool blocked = false;
        std::string reason;
    };
    
    BlockResult checkBlock(uint32_t src_ip, AppType app, const std::string& sni) const {
        std::lock_guard<std::mutex> lock(mutex_);
        if (blocked_ips_.count(src_ip)) {
            return {true, "IP " + ipUintToString(src_ip)};
        }
        if (blocked_apps_.count(app)) {
            return {true, "App " + appTypeToString(app)};
        }
        for (const auto& dom : blocked_domains_) {
            if (!dom.empty() && !sni.empty()) {
                if (dom[0] == '*' && dom.size() > 1 && dom[1] == '.') {
                    std::string suffix = dom.substr(1);
                    if (sni.size() >= suffix.size() &&
                        sni.compare(sni.size() - suffix.size(), suffix.size(), suffix) == 0) {
                        return {true, "Domain " + dom};
                    }
                } else if (sni.find(dom) != std::string::npos) {
                    return {true, "Domain " + dom};
                }
            }
        }
        return {false, ""};
    }
    
    bool isBlocked(uint32_t src_ip, AppType app, const std::string& sni) const {
        return checkBlock(src_ip, app, sni).blocked;
    }

private:
    static uint32_t parseIP(const std::string& ip) {
        uint32_t result = 0;
        int octet = 0, shift = 0;
        for (char c : ip) {
            if (c == '.') { result |= (octet << shift); shift += 8; octet = 0; }
            else if (c >= '0' && c <= '9') octet = octet * 10 + (c - '0');
        }
        return result | (octet << shift);
    }
    
    mutable std::mutex mutex_;
    std::unordered_set<uint32_t> blocked_ips_;
    std::unordered_set<AppType> blocked_apps_;
    std::vector<std::string> blocked_domains_;
};

// =============================================================================
// Statistics (thread-safe)
// =============================================================================
struct Stats {
    std::atomic<uint64_t> total_packets{0};
    std::atomic<uint64_t> total_bytes{0};
    std::atomic<uint64_t> forwarded{0};
    std::atomic<uint64_t> dropped{0};
    std::atomic<uint64_t> tcp_packets{0};
    std::atomic<uint64_t> udp_packets{0};
    std::atomic<uint64_t> other_packets{0};
    
    // Per-app stats (protected by mutex)
    mutable std::mutex app_mutex;
    std::unordered_map<AppType, uint64_t> app_counts;
    std::unordered_map<std::string, AppType> detected_snis;
    
    void recordApp(AppType app, const std::string& sni) {
        std::lock_guard<std::mutex> lock(app_mutex);
        app_counts[app]++;
        if (!sni.empty()) {
            detected_snis[sni] = app;
        }
    }
};

// =============================================================================
// Fast Path Processor (one per FP thread)
// =============================================================================
class FastPath {
public:
    FastPath(int id, Rules* rules, Stats* stats, TSQueue<Packet>* output_queue)
        : id_(id), rules_(rules), stats_(stats), output_queue_(output_queue) {}
    
    void start() {
        running_ = true;
        thread_ = std::thread(&FastPath::run, this);
    }
    
    void stop() {
        running_ = false;
        input_queue_.shutdown();
        if (thread_.joinable()) thread_.join();
    }
    
    TSQueue<Packet>& queue() { return input_queue_; }
    size_t getQueueDepth() const { return input_queue_.size(); }
    
    uint64_t processed() const { return processed_; }
    uint64_t forwarded() const { return forwarded_; }
    uint64_t dropped() const { return dropped_; }
    
    size_t activeFlows() const {
        std::lock_guard<std::mutex> lock(flow_mutex_);
        return flows_.size();
    }
    
    std::vector<FlowEntry> getAllFlows() const {
        std::lock_guard<std::mutex> lock(flow_mutex_);
        std::vector<FlowEntry> res;
        res.reserve(flows_.size());
        for (const auto& [tuple, flow] : flows_) {
            res.push_back(flow);
        }
        return res;
    }

private:
    int id_;
    Rules* rules_;
    Stats* stats_;
    TSQueue<Packet>* output_queue_;
    TSQueue<Packet> input_queue_;
    
    mutable std::mutex flow_mutex_;
    std::unordered_map<FiveTuple, FlowEntry, FiveTupleHash> flows_;
    
    std::atomic<bool> running_{false};
    std::thread thread_;
    std::atomic<uint64_t> processed_{0};
    std::atomic<uint64_t> forwarded_{0};
    std::atomic<uint64_t> dropped_{0};
    
    void updateTCPState(FlowEntry& flow, uint8_t tcp_flags) {
        constexpr uint8_t SYN = 0x02;
        constexpr uint8_t ACK = 0x10;
        constexpr uint8_t FIN = 0x01;
        constexpr uint8_t RST = 0x04;
        
        if (tcp_flags & SYN) {
            if (tcp_flags & ACK) {
                flow.syn_ack_seen = true;
                flow.journey_steps.push_back("SYN-ACK: Server Handshake");
            } else {
                flow.syn_seen = true;
                flow.journey_steps.push_back("SYN: Client Request");
            }
        }
        if (flow.syn_seen && flow.syn_ack_seen && (tcp_flags & ACK)) {
            flow.journey_steps.push_back("ESTABLISHED: 3-Way Handshake");
        }
        if (tcp_flags & FIN) {
            flow.fin_seen = true;
            flow.journey_steps.push_back("FIN: Connection Teardown");
        }
        if (tcp_flags & RST) {
            flow.journey_steps.push_back("RST: Connection Reset");
        }
    }
    
    void run() {
        while (running_ || input_queue_.size() > 0) {
            auto pkt_opt = input_queue_.pop(50);
            if (!pkt_opt) continue;
            
            processed_++;
            Packet& pkt = *pkt_opt;
            
            FlowTelemetryEvent flow_ev;
            bool should_emit_flow = false;
            
            {
                std::lock_guard<std::mutex> lock(flow_mutex_);
                FlowEntry& flow = flows_[pkt.tuple];
                bool is_new = (flow.packets == 0);
                if (is_new) {
                    flow.tuple = pkt.tuple;
                    flow.created_at_ms = TelemetryCollector::getCurrentTimeMs();
                }
                flow.packets++;
                flow.bytes += pkt.data.size();
                flow.last_seen_ms = TelemetryCollector::getCurrentTimeMs();
                
                if (pkt.tuple.protocol == 6) {
                    updateTCPState(flow, pkt.tcp_flags);
                }
                
                // Try to classify if not done yet
                if (!flow.classified) {
                    classifyFlow(pkt, flow);
                }
                
                // Check blocking
                if (!flow.blocked) {
                    auto res = rules_->checkBlock(pkt.tuple.src_ip, flow.app_type, flow.sni);
                    if (res.blocked) {
                        flow.blocked = true;
                        flow.block_reason = res.reason;
                        flow.journey_steps.push_back("Rule Match: " + res.reason + " (BLOCKED)");
                        
                        TelemetryCollector::getInstance().emitSecurityEvent(
                            "RULE_MATCHED", res.reason,
                            ipUintToString(pkt.tuple.src_ip),
                            ipUintToString(pkt.tuple.dst_ip),
                            appTypeToString(flow.app_type),
                            flow.sni,
                            id_
                        );
                    }
                }
                
                if (flow.blocked) {
                    if (flow.packets > 1) {
                        if (std::find(flow.journey_steps.begin(), flow.journey_steps.end(), "Subsequent Packets Dropped") == flow.journey_steps.end()) {
                            flow.journey_steps.push_back("Subsequent Packets Dropped");
                        }
                    }
                } else {
                    if (flow.journey_steps.empty() || flow.journey_steps.back() != "Forwarded") {
                        flow.journey_steps.push_back("Forwarded");
                    }
                }
                
                // Record stats
                stats_->recordApp(flow.app_type, flow.sni);
                
                if (is_new || flow.classified || flow.blocked || flow.packets <= 3) {
                    should_emit_flow = true;
                    flow_ev.flow_id = pkt.tuple.toString();
                    flow_ev.src_ip = ipUintToString(pkt.tuple.src_ip);
                    flow_ev.dst_ip = ipUintToString(pkt.tuple.dst_ip);
                    flow_ev.src_port = pkt.tuple.src_port;
                    flow_ev.dst_port = pkt.tuple.dst_port;
                    flow_ev.protocol = (pkt.tuple.protocol == 6 ? "TCP" : (pkt.tuple.protocol == 17 ? "UDP" : "OTHER"));
                    flow_ev.sni = flow.sni;
                    flow_ev.application = appTypeToString(flow.app_type);
                    flow_ev.packets = flow.packets;
                    flow_ev.bytes = flow.bytes;
                    flow_ev.status = (flow.blocked ? "BLOCKED" : "FORWARDED");
                    flow_ev.block_reason = flow.block_reason;
                    flow_ev.fast_path_id = id_;
                    flow_ev.created_at_ms = flow.created_at_ms;
                    flow_ev.last_seen_ms = flow.last_seen_ms;
                    flow_ev.journey_steps = flow.journey_steps;
                }
                
                // Forward or drop
                if (flow.blocked) {
                    dropped_++;
                    stats_->dropped++;
                } else {
                    forwarded_++;
                    stats_->forwarded++;
                    output_queue_->push(std::move(pkt));
                }
            }
            
            if (should_emit_flow) {
                TelemetryCollector::getInstance().emitFlowUpdated(flow_ev);
            }
        }
    }
    
    void classifyFlow(Packet& pkt, FlowEntry& flow) {
        // Try SNI extraction for HTTPS
        if (pkt.tuple.dst_port == 443 && pkt.payload_length > 5) {
            const uint8_t* payload = pkt.data.data() + pkt.payload_offset;
            auto sni = SNIExtractor::extract(payload, pkt.payload_length);
            if (sni) {
                flow.sni = *sni;
                flow.app_type = sniToAppType(*sni);
                flow.classified = true;
                flow.journey_steps.push_back("TLS Client Hello");
                flow.journey_steps.push_back("SNI Detected: " + *sni);
                flow.journey_steps.push_back("Application Classified: " + appTypeToString(flow.app_type));
                return;
            }
        }
        
        // Try HTTP Host extraction
        if (pkt.tuple.dst_port == 80 && pkt.payload_length > 10) {
            const uint8_t* payload = pkt.data.data() + pkt.payload_offset;
            auto host = HTTPHostExtractor::extract(payload, pkt.payload_length);
            if (host) {
                flow.sni = *host;
                flow.app_type = sniToAppType(*host);
                flow.classified = true;
                flow.journey_steps.push_back("HTTP Request: Host Header");
                flow.journey_steps.push_back("Host Detected: " + *host);
                flow.journey_steps.push_back("Application Classified: " + appTypeToString(flow.app_type));
                return;
            }
        }
        
        // DNS
        if (pkt.tuple.dst_port == 53 || pkt.tuple.src_port == 53) {
            flow.app_type = AppType::DNS;
            flow.classified = true;
            flow.journey_steps.push_back("DNS Query Traffic");
            return;
        }
        
        // Port-based fallback
        if (pkt.tuple.dst_port == 443) {
            flow.app_type = AppType::HTTPS;
            flow.journey_steps.push_back("Port 443 HTTPS");
        } else if (pkt.tuple.dst_port == 80) {
            flow.app_type = AppType::HTTP;
            flow.journey_steps.push_back("Port 80 HTTP");
        }
    }
};

// =============================================================================
// Load Balancer (one per LB thread)
// =============================================================================
class LoadBalancer {
public:
    LoadBalancer(int id, std::vector<FastPath*> fps)
        : id_(id), fps_(std::move(fps)), num_fps_(fps_.size()) {}
    
    void start() {
        running_ = true;
        thread_ = std::thread(&LoadBalancer::run, this);
    }
    
    void stop() {
        running_ = false;
        input_queue_.shutdown();
        if (thread_.joinable()) thread_.join();
    }
    
    TSQueue<Packet>& queue() { return input_queue_; }
    size_t getQueueDepth() const { return input_queue_.size(); }
    
    uint64_t dispatched() const { return dispatched_; }
    uint64_t received() const { return received_; }

private:
    int id_;
    std::vector<FastPath*> fps_;
    size_t num_fps_;
    TSQueue<Packet> input_queue_;
    
    std::atomic<bool> running_{false};
    std::thread thread_;
    std::atomic<uint64_t> received_{0};
    std::atomic<uint64_t> dispatched_{0};
    
    void run() {
        while (running_ || input_queue_.size() > 0) {
            auto pkt_opt = input_queue_.pop(50);
            if (!pkt_opt) continue;
            
            received_++;
            FiveTupleHash hasher;
            size_t fp_idx = hasher(pkt_opt->tuple) % num_fps_;
            
            fps_[fp_idx]->queue().push(std::move(*pkt_opt));
            dispatched_++;
        }
    }
};

// =============================================================================
// DPI Engine
// =============================================================================
class DPIEngine {
public:
    struct Config {
        int num_lbs = 2;
        int fps_per_lb = 2;
        bool json_telemetry = false;
        int pacing_us = 0;
    };
    
    DPIEngine(const Config& cfg) : config_(cfg) {
        int total_fps = cfg.num_lbs * cfg.fps_per_lb;
        
        if (cfg.json_telemetry) {
            TelemetryCollector::getInstance().setJsonTelemetry(true);
        }
        
        if (!cfg.json_telemetry) {
            std::cout << "\n";
            std::cout << "╔══════════════════════════════════════════════════════════════╗\n";
            std::cout << "║              DPI ENGINE v2.0 (Multi-threaded)                 ║\n";
            std::cout << "╠══════════════════════════════════════════════════════════════╣\n";
            std::cout << "║ Load Balancers: " << std::setw(2) << cfg.num_lbs 
                      << "    FPs per LB: " << std::setw(2) << cfg.fps_per_lb
                      << "    Total FPs: " << std::setw(2) << total_fps << "     ║\n";
            std::cout << "╚══════════════════════════════════════════════════════════════╝\n\n";
        }
        
        // Create FP threads
        for (int i = 0; i < total_fps; i++) {
            fps_.push_back(std::make_unique<FastPath>(i, &rules_, &stats_, &output_queue_));
        }
        
        // Create LB threads, each managing a subset of FPs
        for (int lb = 0; lb < cfg.num_lbs; lb++) {
            std::vector<FastPath*> lb_fps;
            int start = lb * cfg.fps_per_lb;
            for (int i = 0; i < cfg.fps_per_lb; i++) {
                lb_fps.push_back(fps_[start + i].get());
            }
            lbs_.push_back(std::make_unique<LoadBalancer>(lb, std::move(lb_fps)));
        }
    }
    
    void blockIP(const std::string& ip) { rules_.blockIP(ip); }
    void unblockIP(const std::string& ip) { rules_.unblockIP(ip); }
    
    void blockApp(const std::string& app) { rules_.blockApp(app); }
    void unblockApp(const std::string& app) { rules_.unblockApp(app); }
    
    void blockDomain(const std::string& dom) { rules_.blockDomain(dom); }
    void unblockDomain(const std::string& dom) { rules_.unblockDomain(dom); }
    
    void stop() {
        running_ = false;
    }
    
    std::vector<ThreadTelemetry> getThreadTelemetry() const {
        std::vector<ThreadTelemetry> result;
        
        // Reader
        ThreadTelemetry r;
        r.thread_type = "READER";
        r.thread_id = 0;
        r.packets_processed = stats_.total_packets.load();
        r.packets_forwarded = stats_.total_packets.load();
        r.packets_dropped = 0;
        r.queue_depth = 0;
        r.utilization = 1.0;
        result.push_back(r);
        
        // LBs
        for (size_t i = 0; i < lbs_.size(); i++) {
            ThreadTelemetry t;
            t.thread_type = "LB";
            t.thread_id = static_cast<int>(i);
            t.packets_processed = lbs_[i]->received();
            t.packets_forwarded = lbs_[i]->dispatched();
            t.packets_dropped = 0;
            t.queue_depth = lbs_[i]->getQueueDepth();
            t.utilization = (stats_.total_packets > 0) ?
                (static_cast<double>(lbs_[i]->received()) / stats_.total_packets.load()) : 0.0;
            result.push_back(t);
        }
        
        // FPs
        for (size_t i = 0; i < fps_.size(); i++) {
            ThreadTelemetry t;
            t.thread_type = "FP";
            t.thread_id = static_cast<int>(i);
            t.packets_processed = fps_[i]->processed();
            t.packets_forwarded = fps_[i]->forwarded();
            t.packets_dropped = fps_[i]->dropped();
            t.queue_depth = fps_[i]->getQueueDepth();
            t.utilization = (stats_.total_packets > 0) ?
                (static_cast<double>(fps_[i]->processed()) / stats_.total_packets.load()) : 0.0;
            result.push_back(t);
        }
        
        // Writer
        ThreadTelemetry w;
        w.thread_type = "WRITER";
        w.thread_id = 0;
        w.packets_processed = stats_.forwarded.load();
        w.packets_forwarded = stats_.forwarded.load();
        w.packets_dropped = 0;
        w.queue_depth = output_queue_.size();
        w.utilization = (stats_.total_packets > 0) ?
            (static_cast<double>(stats_.forwarded.load()) / stats_.total_packets.load()) : 0.0;
        result.push_back(w);
        
        return result;
    }
    
    void emitLiveStats() {
        size_t active_flows = 0;
        for (const auto& fp : fps_) {
            active_flows += fp->activeFlows();
        }
        
        TelemetryCollector::getInstance().emitStatsUpdate(
            stats_.total_packets.load(),
            stats_.total_bytes.load(),
            stats_.forwarded.load(),
            stats_.dropped.load(),
            stats_.tcp_packets.load(),
            stats_.udp_packets.load(),
            stats_.other_packets.load(),
            active_flows
        );
        
        TelemetryCollector::getInstance().emitThreadStats(getThreadTelemetry());
    }
    
    bool process(const std::string& input_file, const std::string& output_file) {
        // Open input
        PcapReader reader;
        if (!reader.open(input_file)) return false;
        
        // Open output
        std::ofstream output(output_file, std::ios::binary);
        if (!output.is_open()) {
            std::cerr << "Cannot open output file\n";
            return false;
        }
        
        // Write PCAP header
        const auto& hdr = reader.getGlobalHeader();
        output.write(reinterpret_cast<const char*>(&hdr), sizeof(hdr));
        
        TelemetryCollector::getInstance().emitEngineStarted(
            input_file,
            config_.num_lbs,
            config_.fps_per_lb
        );
        
        running_ = true;
        
        // Start all worker threads
        for (auto& fp : fps_) fp->start();
        for (auto& lb : lbs_) lb->start();
        
        // Start output writer thread
        std::atomic<bool> output_running{true};
        std::thread output_thread([&]() {
            while (output_running || output_queue_.size() > 0) {
                auto pkt_opt = output_queue_.pop(50);
                if (!pkt_opt) continue;
                
                PcapPacketHeader phdr;
                phdr.ts_sec = pkt_opt->ts_sec;
                phdr.ts_usec = pkt_opt->ts_usec;
                phdr.incl_len = pkt_opt->data.size();
                phdr.orig_len = pkt_opt->data.size();
                
                output.write(reinterpret_cast<const char*>(&phdr), sizeof(phdr));
                output.write(reinterpret_cast<const char*>(pkt_opt->data.data()), pkt_opt->data.size());
            }
        });
        
        // Periodic telemetry thread
        std::atomic<bool> telemetry_running{true};
        std::thread telemetry_thread([&]() {
            while (telemetry_running) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                emitLiveStats();
            }
        });
        
        // Read and dispatch packets
        if (!config_.json_telemetry) {
            std::cout << "[Reader] Processing packets...\n";
        }
        
        RawPacket raw;
        ParsedPacket parsed;
        uint32_t pkt_id = 0;
        
        while (running_ && reader.readNextPacket(raw)) {
            if (!PacketParser::parse(raw, parsed)) continue;
            if (!parsed.has_ip || (!parsed.has_tcp && !parsed.has_udp)) continue;
            
            // Create packet
            Packet pkt;
            pkt.id = pkt_id++;
            pkt.ts_sec = raw.header.ts_sec;
            pkt.ts_usec = raw.header.ts_usec;
            pkt.tcp_flags = parsed.tcp_flags;
            pkt.data = std::move(raw.data);
            
            auto parseIP = [](const std::string& ip) -> uint32_t {
                uint32_t result = 0;
                int octet = 0, shift = 0;
                for (char c : ip) {
                    if (c == '.') { result |= (octet << shift); shift += 8; octet = 0; }
                    else if (c >= '0' && c <= '9') octet = octet * 10 + (c - '0');
                }
                return result | (octet << shift);
            };
            
            pkt.tuple.src_ip = parseIP(parsed.src_ip);
            pkt.tuple.dst_ip = parseIP(parsed.dest_ip);
            pkt.tuple.src_port = parsed.src_port;
            pkt.tuple.dst_port = parsed.dest_port;
            pkt.tuple.protocol = parsed.protocol;
            
            pkt.payload_offset = 14;  // Ethernet
            if (pkt.data.size() >= 34) {
                uint8_t ip_ihl = pkt.data[14] & 0x0F;
                pkt.payload_offset += ip_ihl * 4;
                
                if (parsed.has_tcp && pkt.payload_offset + 20 <= pkt.data.size()) {
                    uint8_t tcp_off = (pkt.data[pkt.payload_offset + 12] >> 4) & 0x0F;
                    pkt.payload_offset += tcp_off * 4;
                } else if (parsed.has_udp) {
                    pkt.payload_offset += 8;
                }
                
                if (pkt.payload_offset < pkt.data.size()) {
                    pkt.payload_length = pkt.data.size() - pkt.payload_offset;
                } else {
                    pkt.payload_length = 0;
                }
            }
            
            // Emit packet sample for inspector occasionally
            if (pkt_id <= 30 || pkt_id % 10 == 0) {
                PacketSample sample;
                sample.packet_id = pkt.id;
                sample.timestamp_str = std::to_string(pkt.ts_sec) + "." + std::to_string(pkt.ts_usec);
                sample.src_mac = parsed.src_mac;
                sample.dst_mac = parsed.dest_mac;
                sample.ethertype = "0x0800 (IPv4)";
                sample.src_ip = parsed.src_ip;
                sample.dst_ip = parsed.dest_ip;
                sample.ip_version = parsed.ip_version;
                sample.ttl = parsed.ttl;
                sample.protocol = (pkt.tuple.protocol == 6 ? "TCP" : (pkt.tuple.protocol == 17 ? "UDP" : "OTHER"));
                sample.src_port = pkt.tuple.src_port;
                sample.dst_port = pkt.tuple.dst_port;
                sample.tcp_flags = PacketParser::tcpFlagsToString(pkt.tcp_flags);
                sample.seq_number = parsed.seq_number;
                sample.ack_number = parsed.ack_number;
                sample.length = pkt.data.size();
                sample.action = "FORWARD";
                TelemetryCollector::getInstance().emitPacketSample(sample);
            }
            
            // Update stats
            stats_.total_packets++;
            stats_.total_bytes += pkt.data.size();
            if (parsed.has_tcp) stats_.tcp_packets++;
            else if (parsed.has_udp) stats_.udp_packets++;
            else stats_.other_packets++;
            
            // Dispatch to LB (hash-based)
            FiveTupleHash hasher;
            size_t lb_idx = hasher(pkt.tuple) % lbs_.size();
            lbs_[lb_idx]->queue().push(std::move(pkt));
            
            if (config_.pacing_us > 0) {
                std::this_thread::sleep_for(std::chrono::microseconds(config_.pacing_us));
            }
        }
        
        if (!config_.json_telemetry) {
            std::cout << "[Reader] Done reading " << pkt_id << " packets\n";
        }
        reader.close();
        
        // Wait for pipeline queues to drain
        auto drain_start = std::chrono::steady_clock::now();
        while (running_) {
            bool empty = true;
            for (auto& lb : lbs_) {
                if (lb->getQueueDepth() > 0) { empty = false; break; }
            }
            if (empty) {
                for (auto& fp : fps_) {
                    if (fp->getQueueDepth() > 0) { empty = false; break; }
                }
            }
            if (empty && output_queue_.size() == 0) {
                std::this_thread::sleep_for(std::chrono::milliseconds(50));
                if (output_queue_.size() == 0) break;
            }
            if (std::chrono::duration_cast<std::chrono::seconds>(std::chrono::steady_clock::now() - drain_start).count() > 10) {
                break;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        // Stop telemetry and workers
        telemetry_running = false;
        if (telemetry_thread.joinable()) telemetry_thread.join();
        
        // Final live stats
        emitLiveStats();
        
        for (auto& lb : lbs_) lb->stop();
        for (auto& fp : fps_) fp->stop();
        
        output_running = false;
        output_queue_.shutdown();
        if (output_thread.joinable()) output_thread.join();
        
        output.close();
        
        TelemetryCollector::getInstance().emitEngineStopped(
            stats_.total_packets.load(),
            stats_.forwarded.load(),
            stats_.dropped.load()
        );
        
        if (!config_.json_telemetry) {
            printReport();
        }
        
        return true;
    }

private:
    Config config_;
    Rules rules_;
    Stats stats_;
    TSQueue<Packet> output_queue_;
    std::vector<std::unique_ptr<FastPath>> fps_;
    std::vector<std::unique_ptr<LoadBalancer>> lbs_;
    std::atomic<bool> running_{false};
    
    void printReport() {
        std::cout << "\n";
        std::cout << "╔══════════════════════════════════════════════════════════════╗\n";
        std::cout << "║                      PROCESSING REPORT                        ║\n";
        std::cout << "╠══════════════════════════════════════════════════════════════╣\n";
        std::cout << "║ Total Packets:      " << std::setw(12) << stats_.total_packets.load() << "                           ║\n";
        std::cout << "║ Total Bytes:        " << std::setw(12) << stats_.total_bytes.load() << "                           ║\n";
        std::cout << "║ TCP Packets:        " << std::setw(12) << stats_.tcp_packets.load() << "                           ║\n";
        std::cout << "║ UDP Packets:        " << std::setw(12) << stats_.udp_packets.load() << "                           ║\n";
        std::cout << "╠══════════════════════════════════════════════════════════════╣\n";
        std::cout << "║ Forwarded:          " << std::setw(12) << stats_.forwarded.load() << "                           ║\n";
        std::cout << "║ Dropped:            " << std::setw(12) << stats_.dropped.load() << "                           ║\n";
        
        // Thread stats
        std::cout << "╠══════════════════════════════════════════════════════════════╣\n";
        std::cout << "║ THREAD STATISTICS                                             ║\n";
        for (size_t i = 0; i < lbs_.size(); i++) {
            std::cout << "║   LB" << i << " dispatched:   " << std::setw(12) << lbs_[i]->dispatched() << "                           ║\n";
        }
        for (size_t i = 0; i < fps_.size(); i++) {
            std::cout << "║   FP" << i << " processed:    " << std::setw(12) << fps_[i]->processed() << "                           ║\n";
        }
        
        // App distribution
        std::cout << "╠══════════════════════════════════════════════════════════════╣\n";
        std::cout << "║                   APPLICATION BREAKDOWN                       ║\n";
        std::cout << "╠══════════════════════════════════════════════════════════════╣\n";
        
        std::lock_guard<std::mutex> lock(stats_.app_mutex);
        
        std::vector<std::pair<AppType, uint64_t>> sorted_apps(
            stats_.app_counts.begin(), stats_.app_counts.end());
        std::sort(sorted_apps.begin(), sorted_apps.end(),
                  [](const auto& a, const auto& b) { return a.second > b.second; });
        
        uint64_t total = stats_.total_packets.load();
        for (const auto& [app, count] : sorted_apps) {
            double pct = total > 0 ? (100.0 * count / total) : 0;
            int bar = static_cast<int>(pct / 5);
            std::string bar_str(bar, '#');
            
            std::cout << "║ " << std::setw(15) << std::left << appTypeToString(app)
                      << std::setw(8) << std::right << count
                      << " " << std::setw(5) << std::fixed << std::setprecision(1) << pct << "% "
                      << std::setw(20) << std::left << bar_str << "  ║\n";
        }
        
        std::cout << "╚══════════════════════════════════════════════════════════════╝\n";
        
        // Detected SNIs
        if (!stats_.detected_snis.empty()) {
            std::cout << "\n[Detected Domains/SNIs]\n";
            for (const auto& [sni, app] : stats_.detected_snis) {
                std::cout << "  - " << sni << " -> " << appTypeToString(app) << "\n";
            }
        }
    }
};

// =============================================================================
// CLI Main
// =============================================================================
void printUsage(const char* prog) {
    std::cout << R"(
DPI Engine v2.0 - Multi-threaded Deep Packet Inspection & Telemetry
====================================================================

Usage: )" << prog << R"( <input.pcap> <output.pcap> [options]

Options:
  --block-ip <ip>        Block source IP
  --block-app <app>      Block application (YouTube, Facebook, etc.)
  --block-domain <dom>   Block domain (supports wildcards: *.facebook.com)
  --lbs <n>              Number of load balancer threads (default: 2)
  --fps <n>              FP threads per LB (default: 2)
  --telemetry-json       Output live structured JSON telemetry for monitoring adapter
  --pacing-us <n>        Pacing delay in microseconds between packets
  --interactive          Listen on stdin for dynamic runtime commands

Example:
  )" << prog << R"( capture.pcap filtered.pcap --block-app YouTube --block-ip 192.168.1.50
)";
}

std::vector<std::string> splitString(const std::string& s) {
    std::vector<std::string> tokens;
    std::istringstream iss(s);
    std::string token;
    while (iss >> token) {
        tokens.push_back(token);
    }
    return tokens;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printUsage(argv[0]);
        return 1;
    }
    
    std::string input = "";
    std::string output = "test_out.pcap";
    
    DPIEngine::Config cfg;
    std::vector<std::string> block_ips, block_apps, block_domains;
    bool interactive = false;
    
    int start_opt = 1;
    if (argc >= 3 && argv[1][0] != '-' && argv[2][0] != '-') {
        input = argv[1];
        output = argv[2];
        start_opt = 3;
    } else if (argc >= 2 && argv[1][0] != '-') {
        input = argv[1];
        start_opt = 2;
    }
    
    for (int i = start_opt; i < argc; i++) {
        std::string arg = argv[i];
        if ((arg == "--pcap" || arg == "-i" || arg == "--input") && i + 1 < argc) input = argv[++i];
        else if ((arg == "-o" || arg == "--output") && i + 1 < argc) output = argv[++i];
        else if (arg == "--block-ip" && i + 1 < argc) block_ips.push_back(argv[++i]);
        else if (arg == "--block-app" && i + 1 < argc) block_apps.push_back(argv[++i]);
        else if (arg == "--block-domain" && i + 1 < argc) block_domains.push_back(argv[++i]);
        else if ((arg == "--lbs" || arg == "--lb-threads") && i + 1 < argc) cfg.num_lbs = std::stoi(argv[++i]);
        else if ((arg == "--fps" || arg == "--fp-threads") && i + 1 < argc) cfg.fps_per_lb = std::stoi(argv[++i]);
        else if (arg == "--telemetry-json") cfg.json_telemetry = true;
        else if (arg == "--pacing-us" && i + 1 < argc) cfg.pacing_us = std::stoi(argv[++i]);
        else if (arg == "--interactive") interactive = true;
    }
    
    if (input.empty()) {
        std::cerr << "Error: No input PCAP file specified.\n";
        printUsage(argv[0]);
        return 1;
    }
    
    DPIEngine engine(cfg);
    
    for (const auto& ip : block_ips) engine.blockIP(ip);
    for (const auto& app : block_apps) engine.blockApp(app);
    for (const auto& dom : block_domains) engine.blockDomain(dom);
    
    std::atomic<bool> stop_interactive{false};
    std::thread stdin_thread;
    if (interactive) {
        stdin_thread = std::thread([&]() {
            std::string line;
            while (!stop_interactive && std::getline(std::cin, line)) {
                if (line.empty()) continue;
                auto parts = splitString(line);
                if (parts.empty()) continue;
                
                std::string cmd = parts[0];
                if (cmd == "BLOCK_IP" && parts.size() > 1) {
                    engine.blockIP(parts[1]);
                } else if (cmd == "UNBLOCK_IP" && parts.size() > 1) {
                    engine.unblockIP(parts[1]);
                } else if (cmd == "BLOCK_APP" && parts.size() > 1) {
                    engine.blockApp(parts[1]);
                } else if (cmd == "UNBLOCK_APP" && parts.size() > 1) {
                    engine.unblockApp(parts[1]);
                } else if (cmd == "BLOCK_DOMAIN" && parts.size() > 1) {
                    engine.blockDomain(parts[1]);
                } else if (cmd == "UNBLOCK_DOMAIN" && parts.size() > 1) {
                    engine.unblockDomain(parts[1]);
                } else if (cmd == "STOP" || cmd == "QUIT") {
                    engine.stop();
                    break;
                }
            }
        });
    }
    
    if (!engine.process(input, output)) {
        stop_interactive = true;
        if (stdin_thread.joinable()) stdin_thread.detach();
        return 1;
    }
    
    stop_interactive = true;
    if (stdin_thread.joinable()) {
        stdin_thread.detach();
    }
    
    if (!cfg.json_telemetry) {
        std::cout << "\nOutput written to: " << output << "\n";
    }
    return 0;
}

#include "telemetry_collector.h"
#include <sstream>
#include <iomanip>
#include <chrono>

namespace DPI {

TelemetryCollector& TelemetryCollector::getInstance() {
    static TelemetryCollector instance;
    return instance;
}

uint64_t TelemetryCollector::getCurrentTimeMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}

void TelemetryCollector::writeJsonLine(const std::string& json_str) {
    if (!json_telemetry_enabled_) return;
    std::lock_guard<std::mutex> lock(emit_mutex_);
    std::cout << "[TELEMETRY_JSON]" << json_str << std::endl;
}

static std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if ('\x00' <= c && c <= '\x1f') {
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
        } else {
            o << c;
        }
    }
    return o.str();
}

void TelemetryCollector::emitEngineStarted(const std::string& input_file, int lbs, int fps) {
    if (!json_telemetry_enabled_) return;
    std::ostringstream ss;
    ss << "{\"type\":\"ENGINE_STARTED\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":{\"input_file\":\"" << escapeJson(input_file) << "\""
       << ",\"num_lbs\":" << lbs
       << ",\"fps_per_lb\":" << fps
       << ",\"total_fps\":" << (lbs * fps) << "}}";
    writeJsonLine(ss.str());
}

void TelemetryCollector::emitEngineStopped(uint64_t total_packets, uint64_t forwarded, uint64_t dropped) {
    if (!json_telemetry_enabled_) return;
    std::ostringstream ss;
    ss << "{\"type\":\"ENGINE_STOPPED\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":{\"total_packets\":" << total_packets
       << ",\"forwarded_packets\":" << forwarded
       << ",\"dropped_packets\":" << dropped << "}}";
    writeJsonLine(ss.str());
}

void TelemetryCollector::emitStatsUpdate(uint64_t total_packets, uint64_t total_bytes,
                                         uint64_t forwarded, uint64_t dropped,
                                         uint64_t tcp, uint64_t udp, uint64_t other,
                                         uint64_t active_flows) {
    if (!json_telemetry_enabled_) return;
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - last_stats_emit_).count();
    if (elapsed < rate_limit_ms_ && total_packets > 0) return;
    last_stats_emit_ = now;

    std::ostringstream ss;
    ss << "{\"type\":\"STATS_UPDATE\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":{"
       << "\"total_packets\":" << total_packets
       << ",\"total_bytes\":" << total_bytes
       << ",\"forwarded_packets\":" << forwarded
       << ",\"dropped_packets\":" << dropped
       << ",\"tcp_packets\":" << tcp
       << ",\"udp_packets\":" << udp
       << ",\"other_packets\":" << other
       << ",\"active_flows\":" << active_flows
       << "}}";
    writeJsonLine(ss.str());
}

void TelemetryCollector::emitFlowUpdated(const FlowTelemetryEvent& flow) {
    if (!json_telemetry_enabled_) return;
    std::ostringstream ss;
    ss << "{\"type\":\"FLOW_UPDATED\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":{"
       << "\"flow_id\":\"" << escapeJson(flow.flow_id) << "\""
       << ",\"src_ip\":\"" << escapeJson(flow.src_ip) << "\""
       << ",\"dst_ip\":\"" << escapeJson(flow.dst_ip) << "\""
       << ",\"src_port\":" << flow.src_port
       << ",\"dst_port\":" << flow.dst_port
       << ",\"protocol\":\"" << escapeJson(flow.protocol) << "\""
       << ",\"sni\":\"" << escapeJson(flow.sni) << "\""
       << ",\"application\":\"" << escapeJson(flow.application) << "\""
       << ",\"packets\":" << flow.packets
       << ",\"bytes\":" << flow.bytes
       << ",\"status\":\"" << escapeJson(flow.status) << "\""
       << ",\"block_reason\":\"" << escapeJson(flow.block_reason) << "\""
       << ",\"fast_path\":" << flow.fast_path_id
       << ",\"created_at\":" << flow.created_at_ms
       << ",\"last_seen\":" << flow.last_seen_ms
       << ",\"journey\":[";
    for (size_t i = 0; i < flow.journey_steps.size(); i++) {
        if (i > 0) ss << ",";
        ss << "\"" << escapeJson(flow.journey_steps[i]) << "\"";
    }
    ss << "]}}";
    writeJsonLine(ss.str());
}

void TelemetryCollector::emitSecurityEvent(const std::string& type, const std::string& detail,
                                           const std::string& src_ip, const std::string& dst_ip,
                                           const std::string& app, const std::string& sni,
                                           int fp_id) {
    if (!json_telemetry_enabled_) return;
    std::ostringstream ss;
    ss << "{\"type\":\"SECURITY_EVENT\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":{"
       << "\"event_type\":\"" << escapeJson(type) << "\""
       << ",\"detail\":\"" << escapeJson(detail) << "\""
       << ",\"src_ip\":\"" << escapeJson(src_ip) << "\""
       << ",\"dst_ip\":\"" << escapeJson(dst_ip) << "\""
       << ",\"application\":\"" << escapeJson(app) << "\""
       << ",\"sni\":\"" << escapeJson(sni) << "\""
       << ",\"fast_path_id\":" << fp_id
       << "}}";
    writeJsonLine(ss.str());
}

void TelemetryCollector::emitThreadStats(const std::vector<ThreadTelemetry>& threads) {
    if (!json_telemetry_enabled_) return;
    std::ostringstream ss;
    ss << "{\"type\":\"THREAD_STATS\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":[";
    for (size_t i = 0; i < threads.size(); i++) {
        if (i > 0) ss << ",";
        const auto& t = threads[i];
        ss << "{"
           << "\"thread_type\":\"" << escapeJson(t.thread_type) << "\""
           << ",\"thread_id\":" << t.thread_id
           << ",\"packets_processed\":" << t.packets_processed
           << ",\"packets_forwarded\":" << t.packets_forwarded
           << ",\"packets_dropped\":" << t.packets_dropped
           << ",\"queue_depth\":" << t.queue_depth
           << ",\"utilization\":" << std::fixed << std::setprecision(2) << t.utilization
           << "}";
    }
    ss << "]}";
    writeJsonLine(ss.str());
}

void TelemetryCollector::emitPacketSample(const PacketSample& sample) {
    if (!json_telemetry_enabled_) return;
    std::ostringstream ss;
    ss << "{\"type\":\"PACKET_SAMPLE\",\"timestamp\":" << getCurrentTimeMs()
       << ",\"data\":{"
       << "\"packet_id\":" << sample.packet_id
       << ",\"timestamp_str\":\"" << escapeJson(sample.timestamp_str) << "\""
       << ",\"src_mac\":\"" << escapeJson(sample.src_mac) << "\""
       << ",\"dst_mac\":\"" << escapeJson(sample.dst_mac) << "\""
       << ",\"ethertype\":\"" << escapeJson(sample.ethertype) << "\""
       << ",\"src_ip\":\"" << escapeJson(sample.src_ip) << "\""
       << ",\"dst_ip\":\"" << escapeJson(sample.dst_ip) << "\""
       << ",\"ip_version\":" << static_cast<int>(sample.ip_version)
       << ",\"ttl\":" << static_cast<int>(sample.ttl)
       << ",\"protocol\":\"" << escapeJson(sample.protocol) << "\""
       << ",\"src_port\":" << sample.src_port
       << ",\"dst_port\":" << sample.dst_port
       << ",\"tcp_flags\":\"" << escapeJson(sample.tcp_flags) << "\""
       << ",\"seq_number\":" << sample.seq_number
       << ",\"ack_number\":" << sample.ack_number
       << ",\"length\":" << sample.length
       << ",\"sni\":\"" << escapeJson(sample.sni) << "\""
       << ",\"application\":\"" << escapeJson(sample.application) << "\""
       << ",\"action\":\"" << escapeJson(sample.action) << "\""
       << ",\"block_reason\":\"" << escapeJson(sample.block_reason) << "\""
       << ",\"fast_path_id\":" << sample.fast_path_id
       << "}}";
    writeJsonLine(ss.str());
}

} // namespace DPI

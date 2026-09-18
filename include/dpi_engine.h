#ifndef DPI_ENGINE_H
#define DPI_ENGINE_H

#include "types.h"
#include "pcap_reader.h"
#include "packet_parser.h"
#include "load_balancer.h"
#include "fast_path.h"
#include "rule_manager.h"
#include "connection_tracker.h"
#include "telemetry_collector.h"
#include <memory>
#include <thread>
#include <atomic>
#include <fstream>
#include <mutex>
#include <vector>

namespace DPI {

class DPIEngine {
public:
    // Configuration
    struct Config {
        int num_load_balancers = 2;
        int fps_per_lb = 2;
        size_t queue_size = 10000;
        std::string rules_file;
        bool verbose = false;
        bool json_telemetry = false;
        int pacing_us = 0; // Microseconds delay between packet reads (for simulated live stream)
    };
    
    DPIEngine(const Config& config);
    ~DPIEngine();
    
    // Initialize the engine (create threads, queues)
    bool initialize();
    
    // Process a PCAP file
    bool processFile(const std::string& input_file, 
                     const std::string& output_file);
    
    // Start the engine (starts all threads)
    void start();
    
    // Stop the engine (stops all threads)
    void stop();
    
    // Wait for processing to complete
    void waitForCompletion();
    
    // ========== Rule Management ==========
    void blockIP(const std::string& ip);
    void unblockIP(const std::string& ip);
    
    void blockApp(AppType app);
    void blockApp(const std::string& app_name);
    void unblockApp(AppType app);
    void unblockApp(const std::string& app_name);
    
    void blockDomain(const std::string& domain);
    void unblockDomain(const std::string& domain);
    
    bool loadRules(const std::string& filename);
    bool saveRules(const std::string& filename);
    
    // ========== Reporting & Telemetry ==========
    std::string generateReport() const;
    std::string generateClassificationReport() const;
    const DPIStats& getStats() const;
    void printStatus() const;
    
    std::vector<ThreadTelemetry> getThreadTelemetry() const;
    void emitLiveStats();
    
    // ========== Accessors ==========
    RuleManager& getRuleManager() { return *rule_manager_; }
    const Config& getConfig() const { return config_; }
    bool isRunning() const { return running_; }

private:
    Config config_;
    
    // Shared components
    std::unique_ptr<RuleManager> rule_manager_;
    std::unique_ptr<GlobalConnectionTable> global_conn_table_;
    
    // Thread pools
    std::unique_ptr<FPManager> fp_manager_;
    std::unique_ptr<LBManager> lb_manager_;
    
    // Output handling
    ThreadSafeQueue<PacketJob> output_queue_;
    std::thread output_thread_;
    std::ofstream output_file_;
    std::mutex output_mutex_;
    
    // Statistics
    DPIStats stats_;
    
    // Control
    std::atomic<bool> running_{false};
    std::atomic<bool> processing_complete_{false};
    
    // Reader thread
    std::thread reader_thread_;
    std::thread telemetry_thread_;
    
    // Reader & output handling
    void outputThreadFunc();
    void handleOutput(const PacketJob& job, PacketAction action);
    bool writeOutputHeader(const PacketAnalyzer::PcapGlobalHeader& header);
    void writeOutputPacket(const PacketJob& job);
    void readerThreadFunc(const std::string& input_file);
    void telemetryThreadFunc();
    
    PacketJob createPacketJob(const PacketAnalyzer::RawPacket& raw,
                              const PacketAnalyzer::ParsedPacket& parsed,
                              uint32_t packet_id);
};

} // namespace DPI

#endif // DPI_ENGINE_H

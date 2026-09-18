#ifndef DPI_TELEMETRY_COLLECTOR_H
#define DPI_TELEMETRY_COLLECTOR_H

#include "types.h"
#include <string>
#include <vector>
#include <mutex>
#include <atomic>
#include <chrono>
#include <functional>
#include <iostream>
#include <sstream>
#include <memory>
#include <unordered_map>

namespace DPI {

// ============================================================================
// Telemetry Models
// ============================================================================

struct FlowTelemetryEvent {
    std::string flow_id;
    std::string src_ip;
    std::string dst_ip;
    uint16_t src_port = 0;
    uint16_t dst_port = 0;
    std::string protocol;
    std::string sni;
    std::string application;
    uint64_t packets = 0;
    uint64_t bytes = 0;
    std::string status = "FORWARDED"; // FORWARDED, BLOCKED
    std::string block_reason;
    int fast_path_id = 0;
    uint64_t created_at_ms = 0;
    uint64_t last_seen_ms = 0;
    std::vector<std::string> journey_steps;
};

struct ThreadTelemetry {
    std::string thread_type; // "READER", "LB", "FP", "WRITER"
    int thread_id = 0;
    uint64_t packets_processed = 0;
    uint64_t packets_forwarded = 0;
    uint64_t packets_dropped = 0;
    size_t queue_depth = 0;
    double utilization = 0.0;
};

struct PacketSample {
    uint32_t packet_id;
    std::string timestamp_str;
    std::string src_mac;
    std::string dst_mac;
    std::string ethertype;
    std::string src_ip;
    std::string dst_ip;
    uint8_t ip_version = 4;
    uint8_t ttl = 64;
    std::string protocol;
    uint16_t src_port = 0;
    uint16_t dst_port = 0;
    std::string tcp_flags;
    uint32_t seq_number = 0;
    uint32_t ack_number = 0;
    size_t length = 0;
    std::string sni;
    std::string application;
    std::string action; // FORWARD, DROP
    std::string block_reason;
    int fast_path_id = 0;
};

class TelemetryCollector {
public:
    static TelemetryCollector& getInstance();

    void setJsonTelemetry(bool enabled) { json_telemetry_enabled_ = enabled; }
    bool isJsonTelemetry() const { return json_telemetry_enabled_; }

    void setRateLimitMs(int ms) { rate_limit_ms_ = ms; }

    // Event emitting
    void emitEngineStarted(const std::string& input_file, int lbs, int fps);
    void emitEngineStopped(uint64_t total_packets, uint64_t forwarded, uint64_t dropped);
    void emitStatsUpdate(uint64_t total_packets, uint64_t total_bytes,
                         uint64_t forwarded, uint64_t dropped,
                         uint64_t tcp, uint64_t udp, uint64_t other,
                         uint64_t active_flows);
    void emitFlowUpdated(const FlowTelemetryEvent& flow);
    void emitSecurityEvent(const std::string& type, const std::string& detail,
                           const std::string& src_ip, const std::string& dst_ip,
                           const std::string& app, const std::string& sni,
                           int fp_id);
    void emitThreadStats(const std::vector<ThreadTelemetry>& threads);
    void emitPacketSample(const PacketSample& sample);

    // Helpers
    static uint64_t getCurrentTimeMs();

private:
    TelemetryCollector() = default;
    ~TelemetryCollector() = default;
    TelemetryCollector(const TelemetryCollector&) = delete;
    TelemetryCollector& operator=(const TelemetryCollector&) = delete;

    std::atomic<bool> json_telemetry_enabled_{false};
    std::atomic<int> rate_limit_ms_{100};
    std::mutex emit_mutex_;
    std::chrono::steady_clock::time_point last_stats_emit_{std::chrono::steady_clock::now()};

    void writeJsonLine(const std::string& json_str);
};

} // namespace DPI

#endif // DPI_TELEMETRY_COLLECTOR_H

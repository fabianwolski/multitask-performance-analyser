// Updated Supabase service for new simplified experiment_results table with d-prime
class SupabaseService {
  constructor() {
    this.url = CONFIG.SUPABASE_URL;
    this.key = CONFIG.SUPABASE_KEY;
  }

  /**
   * Fetch user session data by UUID
   */
  async getUserSession(uuid) {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/user_sessions?unique_id=eq.${uuid}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching user session:", error);
      throw error;
    }
  }

  /**
   * Validate UUID format
   */
  isValidUUID(uuid) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Extract UUID from current URL path
   */
  getUUIDFromURL() {
    const pathSegments = window.location.pathname.split("/");
    const uuid = pathSegments[pathSegments.length - 1];
    return this.isValidUUID(uuid) ? uuid : null;
  }

  /**
   * Get all experiment results with computed d-prime values
   */
  async getAllResults() {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/experiment_results?select=*&order=id.asc`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching all results:", error);
      throw error;
    }
  }

  /**
   * Get results by specific group with all computed metrics
   */
  async getResultsByGroup(groupNumber) {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/experiment_results?assigned_group=eq.${groupNumber}&select=*&order=id.asc`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching results by group:", error);
      throw error;
    }
  }

  /**
   * Get enhanced group summaries with d-prime statistics
   */
  async getGroupSummaries() {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/experiment_results?select=*&order=assigned_group.asc,id.asc`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Calculate group summaries with enhanced SDT metrics
      const groupStats = {
        1: { participants: [], averages: {}, sdtMetrics: {} },
        2: { participants: [], averages: {}, sdtMetrics: {} },
        3: { participants: [], averages: {}, sdtMetrics: {} },
      };

      data.forEach((result) => {
        const group = result.assigned_group;
        if (groupStats[group]) {
          groupStats[group].participants.push(result);
        }
      });

      // Calculate averages and SDT metrics for each group
      Object.keys(groupStats).forEach((group) => {
        const participants = groupStats[group].participants;
        const count = participants.length;

        if (count > 0) {
          // Basic averages
          groupStats[group].averages = {
            count: count,
            avg_total_trials: Math.round(
              participants.reduce((sum, p) => sum + (p.total_trials || 0), 0) /
                count
            ),
            avg_hits: Math.round(
              participants.reduce((sum, p) => sum + (p.total_hits || 0), 0) /
                count
            ),
            avg_misses: Math.round(
              participants.reduce((sum, p) => sum + (p.total_misses || 0), 0) /
                count
            ),
            avg_false_alarms: Math.round(
              participants.reduce(
                (sum, p) => sum + (p.total_false_alarms || 0),
                0
              ) / count
            ),
            avg_correct_rejections: Math.round(
              participants.reduce(
                (sum, p) => sum + (p.total_correct_rejections || 0),
                0
              ) / count
            ),
            avg_reaction_time: Math.round(
              participants.reduce(
                (sum, p) => sum + (p.average_reaction_time || 0),
                0
              ) / count
            ),
          };

          // Enhanced SDT metrics using computed database values
          groupStats[group].sdtMetrics = {
            avg_d_prime: parseFloat(
              (
                participants.reduce(
                  (sum, p) => sum + (parseFloat(p.d_prime) || 0),
                  0
                ) / count
              ).toFixed(4)
            ),
            avg_hit_rate: parseFloat(
              (
                participants.reduce(
                  (sum, p) => sum + (parseFloat(p.hit_rate) || 0),
                  0
                ) / count
              ).toFixed(3)
            ),
            avg_false_alarm_rate: parseFloat(
              (
                participants.reduce(
                  (sum, p) => sum + (parseFloat(p.false_alarm_rate) || 0),
                  0
                ) / count
              ).toFixed(3)
            ),
            avg_criterion: parseFloat(
              (
                participants.reduce(
                  (sum, p) => sum + (parseFloat(p.criterion) || 0),
                  0
                ) / count
              ).toFixed(4)
            ),
            d_prime_range: {
              min: Math.min(
                ...participants.map((p) => parseFloat(p.d_prime) || 0)
              ),
              max: Math.max(
                ...participants.map((p) => parseFloat(p.d_prime) || 0)
              ),
            },
            sensitivity_distribution: this.categorizeSensitivity(
              participants.map((p) => parseFloat(p.d_prime) || 0)
            ),
            bias_distribution: this.categorizeBias(
              participants.map((p) => parseFloat(p.criterion) || 0)
            ),
          };

          // Overall accuracy
          const avg = groupStats[group].averages;
          groupStats[group].averages.overall_accuracy = parseFloat(
            (
              (avg.avg_hits + avg.avg_correct_rejections) /
              avg.avg_total_trials
            ).toFixed(3)
          );
        }
      });

      return groupStats;
    } catch (error) {
      console.error("Error calculating group summaries:", error);
      throw error;
    }
  }

  /**
   * Categorize sensitivity levels based on d-prime values
   */
  categorizeSensitivity(dPrimeValues) {
    const categories = {
      excellent: 0, // d' > 2.0
      good: 0, // d' > 1.5
      moderate: 0, // d' > 1.0
      poor: 0, // d' > 0.5
      very_poor: 0, // d' <= 0.5
    };

    dPrimeValues.forEach((dp) => {
      if (dp > 2.0) categories.excellent++;
      else if (dp > 1.5) categories.good++;
      else if (dp > 1.0) categories.moderate++;
      else if (dp > 0.5) categories.poor++;
      else categories.very_poor++;
    });

    return categories;
  }

  /**
   * Categorize response bias based on criterion values
   */
  categorizeBias(criterionValues) {
    const categories = {
      conservative: 0, // c > 0.5
      moderate_conservative: 0, // 0 < c <= 0.5
      neutral: 0, // c = 0
      moderate_liberal: 0, // -0.5 <= c < 0
      liberal: 0, // c < -0.5
    };

    criterionValues.forEach((c) => {
      if (c > 0.5) categories.conservative++;
      else if (c > 0) categories.moderate_conservative++;
      else if (c === 0) categories.neutral++;
      else if (c >= -0.5) categories.moderate_liberal++;
      else categories.liberal++;
    });

    return categories;
  }

  /**
   * Get enhanced overall experiment statistics
   */
  async getOverallStats() {
    try {
      const allResults = await this.getAllResults();
      const groupSummaries = await this.getGroupSummaries();

      const overallStats = {
        total_participants: allResults.length,
        group_breakdown: {
          group_1: groupSummaries[1].participants.length,
          group_2: groupSummaries[2].participants.length,
          group_3: groupSummaries[3].participants.length,
        },
        overall_averages: {
          avg_total_trials: 0,
          avg_hits: 0,
          avg_misses: 0,
          avg_false_alarms: 0,
          avg_correct_rejections: 0,
          avg_reaction_time: 0,
          overall_accuracy: 0,
        },
        overall_sdt_metrics: {
          avg_d_prime: 0,
          avg_hit_rate: 0,
          avg_false_alarm_rate: 0,
          avg_criterion: 0,
          d_prime_distribution: {},
          bias_distribution: {},
        },
        by_group: groupSummaries,
      };

      // Calculate overall averages including SDT metrics
      if (allResults.length > 0) {
        const totals = allResults.reduce(
          (acc, result) => {
            acc.total_trials += result.total_trials || 0;
            acc.hits += result.total_hits || 0;
            acc.misses += result.total_misses || 0;
            acc.false_alarms += result.total_false_alarms || 0;
            acc.correct_rejections += result.total_correct_rejections || 0;
            acc.reaction_time += result.average_reaction_time || 0;
            acc.d_prime += parseFloat(result.d_prime) || 0;
            acc.hit_rate += parseFloat(result.hit_rate) || 0;
            acc.false_alarm_rate += parseFloat(result.false_alarm_rate) || 0;
            acc.criterion += parseFloat(result.criterion) || 0;
            return acc;
          },
          {
            total_trials: 0,
            hits: 0,
            misses: 0,
            false_alarms: 0,
            correct_rejections: 0,
            reaction_time: 0,
            d_prime: 0,
            hit_rate: 0,
            false_alarm_rate: 0,
            criterion: 0,
          }
        );

        const count = allResults.length;
        overallStats.overall_averages = {
          avg_total_trials: Math.round(totals.total_trials / count),
          avg_hits: Math.round(totals.hits / count),
          avg_misses: Math.round(totals.misses / count),
          avg_false_alarms: Math.round(totals.false_alarms / count),
          avg_correct_rejections: Math.round(totals.correct_rejections / count),
          avg_reaction_time: Math.round(totals.reaction_time / count),
          overall_accuracy: parseFloat(
            (
              (totals.hits + totals.correct_rejections) /
              totals.total_trials
            ).toFixed(3)
          ),
        };

        overallStats.overall_sdt_metrics = {
          avg_d_prime: parseFloat((totals.d_prime / count).toFixed(4)),
          avg_hit_rate: parseFloat((totals.hit_rate / count).toFixed(3)),
          avg_false_alarm_rate: parseFloat(
            (totals.false_alarm_rate / count).toFixed(3)
          ),
          avg_criterion: parseFloat((totals.criterion / count).toFixed(4)),
          d_prime_distribution: this.categorizeSensitivity(
            allResults.map((r) => parseFloat(r.d_prime) || 0)
          ),
          bias_distribution: this.categorizeBias(
            allResults.map((r) => parseFloat(r.criterion) || 0)
          ),
        };
      }

      return overallStats;
    } catch (error) {
      console.error("Error getting overall stats:", error);
      throw error;
    }
  }

  /**
   * Export enhanced data as CSV for analysis
   */
  async exportToCSV() {
    try {
      const allResults = await this.getAllResults();

      if (allResults.length === 0) {
        throw new Error("No data to export");
      }

      // Create enhanced CSV header with all computed metrics
      const headers = [
        "id",
        "assigned_group",
        "total_trials",
        "completed_at",
        "unique_id",
        "total_hits",
        "total_misses",
        "total_false_alarms",
        "total_correct_rejections",
        "average_reaction_time",
        "hit_rate",
        "false_alarm_rate",
        "corrected_hit_rate",
        "corrected_false_alarm_rate",
        "d_prime",
        "criterion",
        "sensitivity_category",
        "bias_direction",
      ];

      // Create CSV rows with computed values
      const rows = allResults.map((result) => [
        result.id,
        result.assigned_group,
        result.total_trials,
        result.completed_at,
        result.unique_id,
        result.total_hits,
        result.total_misses,
        result.total_false_alarms,
        result.total_correct_rejections,
        result.average_reaction_time,
        result.hit_rate,
        result.false_alarm_rate,
        result.corrected_hit_rate,
        result.corrected_false_alarm_rate,
        result.d_prime,
        result.criterion,
        this.getSensitivityCategory(parseFloat(result.d_prime) || 0),
        this.getBiasDirection(parseFloat(result.criterion) || 0),
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map((row) => row.map((field) => `"${field}"`).join(","))
        .join("\n");

      // Create download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `experiment_results_with_dprime_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return true;
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      throw error;
    }
  }

  /**
   * Helper function to get sensitivity category
   */
  getSensitivityCategory(dPrime) {
    if (dPrime > 2.0) return "Excellent";
    if (dPrime > 1.5) return "Good";
    if (dPrime > 1.0) return "Moderate";
    if (dPrime > 0.5) return "Poor";
    return "Very Poor";
  }

  /**
   * Helper function to get bias direction
   */
  getBiasDirection(criterion) {
    if (criterion > 0.5) return "Conservative";
    if (criterion > 0) return "Moderate Conservative";
    if (criterion === 0) return "Neutral";
    if (criterion >= -0.5) return "Moderate Liberal";
    return "Liberal";
  }

  /**
   * Get detailed participant analysis
   */
  async getParticipantDetails(participantId) {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/experiment_results?id=eq.${participantId}&select=*`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching participant details:", error);
      throw error;
    }
  }

  /**
   * Get the latest entry ID for verification
   */
  async getLatestEntry() {
    try {
      const response = await fetch(
        `${this.url}/rest/v1/experiment_results?select=id,d_prime,hit_rate,false_alarm_rate,criterion&order=id.desc&limit=1`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching latest entry:", error);
      throw error;
    }
  }
}

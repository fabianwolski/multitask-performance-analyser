// Updated Data collection and storage service for new schema
class DataService {
  constructor() {
    this.supabaseUrl = CONFIG.SUPABASE_URL;
    this.supabaseKey = CONFIG.SUPABASE_KEY;
    this.trialResults = [];
    this.userUuid = null;
    this.userGroup = null;
    this.sessionStartTime = null;

    // SDT counters (unchanged - these work fine)
    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalFalseAlarms = 0;
    this.totalCorrectRejections = 0;
  }

  /**
   * Initialize data collection session
   */
  initSession(uuid, group) {
    this.userUuid = uuid;
    this.userGroup = group;
    this.sessionStartTime = Date.now();
    this.trialResults = [];

    // Reset SDT counters
    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalFalseAlarms = 0;
    this.totalCorrectRejections = 0;

    console.log(
      `Data collection initialized for UUID: ${uuid}, Group: ${group}`
    );
  }

  /**
   * Record a trial result with PROPER Signal Detection Theory logic
   * (UNCHANGED - this works correctly)
   */
  recordTrial(trialData) {
    const sdtCategory = this.calculateCorrectSDTCategory(trialData);

    const trialResult = {
      trial_number: trialData.trialNumber,
      stimulus_type: trialData.type,
      stimulus_value: trialData.stimulus,
      response_given: trialData.response,
      reaction_time_ms: trialData.responseTime,
      sdt_category: sdtCategory,
      timestamp: new Date().toISOString(),
      stimulus_start_time: trialData.stimulusStartTime,
      stimulus_end_time: trialData.stimulusEndTime,
    };

    this.trialResults.push(trialResult);

    // Update running totals
    this.updateSDTCounts(sdtCategory);

    // Log important trials (reduce audio2 logging)
    if (trialData.type !== "audio2") {
      console.log(`Trial ${trialData.trialNumber}:`, {
        type: trialData.type,
        stimulus: trialData.stimulus,
        response: trialData.response,
        sdt: sdtCategory,
        rt: trialData.responseTime,
      });
    }
  }

  /**
   * Calculate CORRECT Signal Detection Theory category
   * (UNCHANGED - this works correctly)
   */
  calculateCorrectSDTCategory(trialData) {
    const { type, stimulus, response } = trialData;

    // CORRECT SDT LOGIC:
    // HIT = Correct response when should respond
    // MISS = No response when should respond
    // FALSE_ALARM = Wrong response (any incorrect key press)
    // CORRECT_REJECTION = Correctly not responding to number 3

    if (type === "visual") {
      if (stimulus === 3) {
        // Number 3: Should NOT respond
        if (response === null) {
          return "CORRECT_REJECTION"; // Correctly didn't respond
        } else {
          return "FALSE_ALARM"; // Any response to 3 is wrong
        }
      } else {
        // Numbers 1,2,4,5,6,7,8,9: Should respond with spacebar
        if (response === "spacebar") {
          return "HIT"; // Correct response
        } else if (response === null) {
          return "MISS"; // Should have responded but didn't
        } else {
          return "FALSE_ALARM"; // Wrong type of response (arrow keys)
        }
      }
    } else if (type === "audio1") {
      // Sound1: Should respond with left arrow
      if (response === "arrowleft") {
        return "HIT"; // Correct response
      } else if (response === null) {
        return "MISS"; // Should have responded but didn't
      } else {
        return "FALSE_ALARM"; // Wrong response (spacebar, right arrow)
      }
    } else if (type === "audio2") {
      // Sound2: Should respond with right arrow
      if (response === "arrowright") {
        return "HIT"; // Correct response
      } else if (response === null) {
        return "MISS"; // Should have responded but didn't
      } else {
        return "FALSE_ALARM"; // Wrong response (spacebar, left arrow)
      }
    }

    // Fallback (shouldn't reach here)
    return "FALSE_ALARM";
  }

  /**
   * Update running SDT totals
   * (UNCHANGED - this works correctly)
   */
  updateSDTCounts(category) {
    switch (category) {
      case "HIT":
        this.totalHits++;
        break;
      case "MISS":
        this.totalMisses++;
        break;
      case "FALSE_ALARM":
        this.totalFalseAlarms++;
        break;
      case "CORRECT_REJECTION":
        this.totalCorrectRejections++;
        break;
    }
  }

  /**
   * Calculate experiment results for NEW simplified table structure
   * UPDATED: Removed participant_num, updated_at, created_at
   */
  calculateExperimentResults() {
    const reactionTimes = this.trialResults
      .filter((trial) => trial.response_given && trial.reaction_time_ms > 0)
      .map((trial) => trial.reaction_time_ms);

    const averageRT =
      reactionTimes.length > 0
        ? Math.round(
            reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
          )
        : null;

    const results = {
      // UPDATED: Only required fields for new schema
      assigned_group: this.userGroup,
      total_trials: this.trialResults.length,
      completed_at: new Date().toISOString(),
      unique_id: this.userUuid,

      // SDT totals (unchanged - these work fine)
      total_hits: this.totalHits,
      total_misses: this.totalMisses,
      total_false_alarms: this.totalFalseAlarms,
      total_correct_rejections: this.totalCorrectRejections,
      average_reaction_time: averageRT,
    };

    // Verify totals match (unchanged)
    const calculatedTotal =
      this.totalHits +
      this.totalMisses +
      this.totalFalseAlarms +
      this.totalCorrectRejections;
    if (calculatedTotal !== this.trialResults.length) {
      console.error("SDT total mismatch!", {
        calculated: calculatedTotal,
        actual: this.trialResults.length,
        breakdown: {
          hits: this.totalHits,
          misses: this.totalMisses,
          fa: this.totalFalseAlarms,
          cr: this.totalCorrectRejections,
        },
      });
    }

    return results;
  }

  /**
   * Save data to NEW Supabase table structure
   * D-prime and other SDT metrics are calculated automatically by the database
   */
  async saveExperimentData() {
    if (this.trialResults.length === 0) {
      console.warn("No trial data to save");
      return false;
    }

    try {
      console.log(`Saving results for ${this.trialResults.length} trials...`);

      const results = this.calculateExperimentResults();

      console.log("📊 Final Results (before d-prime calculation):", {
        group: results.assigned_group,
        trials: results.total_trials,
        hits: results.total_hits,
        misses: results.total_misses,
        false_alarms: results.total_false_alarms,
        correct_rejections: results.total_correct_rejections,
        avg_rt: results.average_reaction_time,
      });

      // Send to Supabase - d-prime will be calculated automatically
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/experiment_results`,
        {
          method: "POST",
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(results),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const data = await response.json();
      console.log("✅ Results saved successfully with computed metrics:", {
        id: data[0]?.id,
        d_prime: data[0]?.d_prime,
        hit_rate: data[0]?.hit_rate,
        false_alarm_rate: data[0]?.false_alarm_rate,
        criterion: data[0]?.criterion,
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to save results:", error);

      // Backup data to console
      console.log("📋 Backup data:", {
        uuid: this.userUuid,
        group: this.userGroup,
        trials: this.trialResults.length,
        hits: this.totalHits,
        misses: this.totalMisses,
        false_alarms: this.totalFalseAlarms,
        correct_rejections: this.totalCorrectRejections,
        data: this.trialResults,
      });

      return false;
    }
  }

  /**
   * Calculate local d-prime for immediate feedback (optional)
   * This matches the database calculation
   */
  calculateLocalDPrime() {
    const signalTrials = this.totalHits + this.totalMisses;
    const noiseTrials = this.totalFalseAlarms + this.totalCorrectRejections;

    if (signalTrials === 0 || noiseTrials === 0) {
      return 0;
    }

    // Apply correction for extreme values (loglinear correction)
    let hitRate = this.totalHits / signalTrials;
    let faRate = this.totalFalseAlarms / noiseTrials;

    // Correct extreme rates
    if (hitRate === 0) hitRate = 0.5 / signalTrials;
    if (hitRate === 1) hitRate = (signalTrials - 0.5) / signalTrials;
    if (faRate === 0) faRate = 0.5 / noiseTrials;
    if (faRate === 1) faRate = (noiseTrials - 0.5) / noiseTrials;

    // Calculate z-scores using inverse normal approximation
    const zHit = this.inverseNormal(hitRate);
    const zFA = this.inverseNormal(faRate);

    return Math.round((zHit - zFA) * 10000) / 10000; // 4 decimal places
  }

  /**
   * Inverse normal function (approximation)
   */
  inverseNormal(p) {
    if (p <= 0.0001) return -3.719;
    if (p >= 0.9999) return 3.719;
    if (p === 0.5) return 0;

    // Beasley-Springer-Moro algorithm (simplified)
    const a = [
      0, -39.69683028665376, 220.9460984245205, -275.9285104469687,
      138.357751867269, -30.66479806614716, 2.506628277459239,
    ];
    const b = [
      0, -54.47609879822406, 161.5858368580409, -155.6989798598866,
      66.80131188771972, -13.28068155288572,
    ];
    const c = [
      0, -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
      -2.549732539343734, 4.374664141464968, 2.938163982698783,
    ];
    const d = [
      0, 0.007784695709041462, 0.3224671290700398, 2.445134137142996,
      3.754408661907416,
    ];

    let x, r;

    if (p > 0.5) {
      r = Math.sqrt(-Math.log(1.0 - p));
    } else {
      r = Math.sqrt(-Math.log(p));
    }

    if (r <= 5.0) {
      r = r - 1.6;
      x =
        (((((c[6] * r + c[5]) * r + c[4]) * r + c[3]) * r + c[2]) * r + c[1]) *
          r +
        c[0];
      x = x / ((((d[4] * r + d[3]) * r + d[2]) * r + d[1]) * r + 1.0);
    } else {
      r = r - 5.0;
      x =
        (((((a[6] * r + a[5]) * r + a[4]) * r + a[3]) * r + a[2]) * r + a[1]) *
          r +
        a[0];
      x =
        x /
        (((((b[5] * r + b[4]) * r + b[3]) * r + b[2]) * r + b[1]) * r + 1.0);
    }

    if (p > 0.5) {
      x = -x;
    }

    return x;
  }

  /**
   * Get current session statistics with d-prime
   */
  getCurrentStats() {
    return {
      uuid: this.userUuid,
      group: this.userGroup,
      trialsRecorded: this.trialResults.length,
      hits: this.totalHits,
      misses: this.totalMisses,
      falseAlarms: this.totalFalseAlarms,
      correctRejections: this.totalCorrectRejections,
      dPrime: this.calculateLocalDPrime(),
      hitRate:
        this.totalHits + this.totalMisses > 0
          ? this.totalHits / (this.totalHits + this.totalMisses)
          : 0,
      falseAlarmRate:
        this.totalFalseAlarms + this.totalCorrectRejections > 0
          ? this.totalFalseAlarms /
            (this.totalFalseAlarms + this.totalCorrectRejections)
          : 0,
    };
  }

  /**
   * Clear all data
   */
  clearData() {
    this.trialResults = [];
    this.userUuid = null;
    this.userGroup = null;
    this.sessionStartTime = null;

    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalFalseAlarms = 0;
    this.totalCorrectRejections = 0;

    console.log("Data collection cleared");
  }
}

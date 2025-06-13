// Data collection and storage service
class DataService {
  constructor() {
    this.supabaseUrl = CONFIG.SUPABASE_URL;
    this.supabaseKey = CONFIG.SUPABASE_KEY;
    this.trialResults = [];
    this.userUuid = null;
    this.userGroup = null;
    this.sessionStartTime = null;
  }

  /**
   * Initialize data collection session
   * @param {string} uuid - User UUID
   * @param {number} group - User's assigned group
   */
  initSession(uuid, group) {
    this.userUuid = uuid;
    this.userGroup = group;
    this.sessionStartTime = new Date().toISOString();
    this.trialResults = [];

    console.log(
      `Data collection initialized for UUID: ${uuid}, Group: ${group}`
    );
  }

  /**
   * Record a trial result with Signal Detection Theory metrics
   * @param {Object} trialData - Trial data from TrialManager
   */
  recordTrial(trialData) {
    // Calculate Signal Detection Theory metrics
    const sdt = this.calculateSDTMetrics(trialData);

    const trialResult = {
      trial_number: trialData.trialNumber,
      stimulus_type: trialData.type, // 'visual', 'audio1', 'audio2'
      stimulus_value: trialData.stimulus, // number 1-9 or 'sound1'/'sound2'
      signal_present: sdt.signalPresent,
      response_given: sdt.responseGiven,
      response_type: trialData.response, // 'spacebar', 'arrowleft', 'arrowright', null
      reaction_time_ms: trialData.responseTime,
      sdt_outcome: sdt.outcome, // 'hit', 'miss', 'false_alarm', 'correct_rejection'
      timestamp: new Date().toISOString(),
      stimulus_start_time: trialData.stimulusStartTime,
      stimulus_end_time: trialData.stimulusEndTime,
    };

    this.trialResults.push(trialResult);

    // Log important trials (keep most, remove only audio2 type logs)
    if (trialData.type !== "audio2") {
      console.log(`Trial ${trialData.trialNumber}:`, {
        type: trialData.type,
        stimulus: trialData.stimulus,
        response: trialData.response,
        sdt: sdt.outcome,
        rt: trialData.responseTime,
      });
    }
  }

  /**
   * Calculate Signal Detection Theory metrics
   * @param {Object} trialData - Raw trial data
   * @returns {Object} SDT metrics
   */
  calculateSDTMetrics(trialData) {
    let signalPresent, responseGiven, outcome;

    // Determine if signal is present
    if (trialData.type === "visual") {
      // For visual trials, signal present = any number EXCEPT 3
      // (because instruction is to respond to all numbers except 3)
      signalPresent = trialData.stimulus !== 3;
    } else {
      // For audio trials, signal is always present (should always respond)
      signalPresent = true;
    }

    // Determine if response was given
    responseGiven = trialData.response !== null;

    // Calculate SDT outcome
    if (signalPresent && responseGiven) {
      outcome = "hit"; // Correctly responded to signal
    } else if (signalPresent && !responseGiven) {
      outcome = "miss"; // Failed to respond to signal
    } else if (!signalPresent && responseGiven) {
      outcome = "false_alarm"; // Incorrectly responded when no signal (clicked on 3)
    } else {
      outcome = "correct_rejection"; // Correctly did not respond to non-signal (didn't click 3)
    }

    return {
      signalPresent,
      responseGiven,
      outcome,
    };
  }

  /**
   * Send all trial data to Supabase at the end of experiment
   * @returns {Promise<boolean>} Success status
   */
  async saveExperimentData() {
    if (this.trialResults.length === 0) {
      console.warn("No trial data to save");
      return false;
    }

    try {
      console.log(`Saving ${this.trialResults.length} trials to Supabase...`);

      // Prepare the data payload
      const experimentData = {
        user_uuid: this.userUuid,
        assigned_group: this.userGroup,
        session_start_time: this.sessionStartTime,
        session_end_time: new Date().toISOString(),
        total_trials: this.trialResults.length,
        trial_data: this.trialResults,
        created_at: new Date().toISOString(),
      };

      // Send to Supabase experiment_results table
      const response = await fetch(
        `${this.supabaseUrl}/rest/v1/experiment_results`,
        {
          method: "POST",
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(experimentData),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("✅ Experiment data saved successfully");
      this.generateSummaryStats();
      return true;
    } catch (error) {
      console.error("❌ Failed to save experiment data:", error);

      // Fallback: Log data to console for manual recovery
      console.log("📋 Backup data (copy this if needed):", {
        uuid: this.userUuid,
        group: this.userGroup,
        trials: this.trialResults.length,
        data: this.trialResults,
      });

      return false;
    }
  }

  /**
   * Generate summary statistics for console logging
   */
  generateSummaryStats() {
    const stats = {
      totalTrials: this.trialResults.length,
      hits: this.trialResults.filter((t) => t.sdt_outcome === "hit").length,
      misses: this.trialResults.filter((t) => t.sdt_outcome === "miss").length,
      falseAlarms: this.trialResults.filter(
        (t) => t.sdt_outcome === "false_alarm"
      ).length,
      correctRejections: this.trialResults.filter(
        (t) => t.sdt_outcome === "correct_rejection"
      ).length,
      avgReactionTime: this.calculateAverageRT(),
      visualTrials: this.trialResults.filter(
        (t) => t.stimulus_type === "visual"
      ).length,
      audioTrials: this.trialResults.filter((t) =>
        t.stimulus_type.startsWith("audio")
      ).length,
    };

    console.log("📊 Experiment Summary:", stats);
    return stats;
  }

  /**
   * Calculate average reaction time for responses
   * @returns {number} Average RT in milliseconds
   */
  calculateAverageRT() {
    const responsesWithRT = this.trialResults.filter(
      (t) => t.response_given && t.reaction_time_ms > 0
    );
    if (responsesWithRT.length === 0) return 0;

    const totalRT = responsesWithRT.reduce(
      (sum, trial) => sum + trial.reaction_time_ms,
      0
    );
    return Math.round(totalRT / responsesWithRT.length);
  }

  /**
   * Get current session statistics (for debugging)
   * @returns {Object} Current session stats
   */
  getCurrentStats() {
    return {
      uuid: this.userUuid,
      group: this.userGroup,
      trialsRecorded: this.trialResults.length,
      sessionDuration: this.sessionStartTime
        ? Math.round((new Date() - new Date(this.sessionStartTime)) / 1000)
        : 0,
    };
  }

  /**
   * Clear all collected data (for testing)
   */
  clearData() {
    this.trialResults = [];
    this.userUuid = null;
    this.userGroup = null;
    this.sessionStartTime = null;
    console.log("Data collection cleared");
  }
}

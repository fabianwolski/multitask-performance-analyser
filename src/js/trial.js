// Trial management for psychology experiment
class TrialManager {
  constructor() {
    this.userGroup = null;
    this.currentTrial = 0;
    this.totalTrials = 0;
    this.trialData = [];
    this.keyHandler = null;
    this.trialTimer = null;
    this.fixationTimer = null;
    this.feedbackTimer = null;
    this.currentStimulus = null;
    this.stimulusStartTime = 0;
    this.stimulusEndTime = 0;
    this.awaitingResponse = false;
    this.isPractice = true;
    this.feedbackEnabled = true;
    this.dataService = new DataService(); // Initialize data service

    // Trial configurations
    this.config = {
      practice: {
        1: { visual: 50, audio1: 0, audio2: 0 }, // Group 1: 50 visual only
        2: { visual: 30, audio1: 10, audio2: 0 }, // Group 2: 30 visual + 10 audio (40 total)
        3: { visual: 25, audio1: 12, audio2: 13 }, // Group 3: 25 visual + 12+13 audio (50 total)
      },
      actual: {
        1: { visual: 500, audio1: 0, audio2: 0 }, // Group 1: 500 visual (~8-12 mins)
        2: { visual: 375, audio1: 125, audio2: 0 }, // Group 2: 375 visual + 125 audio (~12-15 mins)
        3: { visual: 250, audio1: 125, audio2: 125 }, // Group 3: 250 visual + 125+125 audio (~15-18 mins)
      },
    };

    // Timing configurations (in milliseconds)
    this.timing = {
      stimulusMin: 500, // Minimum stimulus display time
      stimulusMax: 1000, // Maximum stimulus display time
      fixationCross: 500, // Fixation cross display time
      feedbackDuration: 1000, // Feedback display time (1 second for audio length)
      audioStimulus: 1000, // Audio stimulus duration (1 second)
    };

    // Audio files
    this.audioFiles = {
      sound1: new Audio("/sound1.mp3"),
      sound2: new Audio("/sound2.mp3"),
    };

    // Preload audio
    this.preloadAudio();
  }

  /**
   * Preload audio files
   */
  preloadAudio() {
    Object.values(this.audioFiles).forEach((audio) => {
      audio.preload = "auto";
      audio.load();
    });
  }

  /**
   * Initialize trial for specific group
   * @param {number} group - User's assigned group
   * @param {boolean} isPractice - Whether this is practice or actual experiment
   * @param {string} userUuid - User's UUID (for actual experiment data collection)
   */
  init(group, isPractice = true, userUuid = null) {
    this.userGroup = group;
    this.isPractice = isPractice;
    this.feedbackEnabled = isPractice;
    this.currentTrial = 0;
    this.trialData = [];

    // Initialize data collection for actual experiment
    if (!isPractice && userUuid) {
      this.dataService.initSession(userUuid, group);
    }

    // Generate trial sequence
    this.generateTrialSequence();

    this.setupKeyboardHandlers();
    this.showTrialInstructions();
  }

  /**
   * Generate randomized trial sequence
   */
  generateTrialSequence() {
    const config = this.isPractice
      ? this.config.practice[this.userGroup]
      : this.config.actual[this.userGroup];
    const trials = [];

    console.log(`Generating trials for Group ${this.userGroup}:`, config);

    // Add visual trials (numbers 1-9)
    for (let i = 0; i < config.visual; i++) {
      trials.push({
        type: "visual",
        stimulus: Math.floor(Math.random() * 9) + 1,
        correctResponse: "spacebar",
        expectedNoResponse: false,
      });
    }
    console.log(`Added ${config.visual} visual trials`);

    // Add audio trials for group 2 and 3
    if (this.userGroup >= 2 && config.audio1 > 0) {
      for (let i = 0; i < config.audio1; i++) {
        trials.push({
          type: "audio1",
          stimulus: "sound1",
          correctResponse: "arrowleft",
          expectedNoResponse: false,
        });
      }
      console.log(`Added ${config.audio1} audio1 trials`);
    }

    if (this.userGroup === 3 && config.audio2 > 0) {
      for (let i = 0; i < config.audio2; i++) {
        trials.push({
          type: "audio2",
          stimulus: "sound2",
          correctResponse: "arrowright",
          expectedNoResponse: false,
        });
      }
      console.log(`Added ${config.audio2} audio2 trials`);
    }

    // Set correct response expectations for number 3
    trials.forEach((trial) => {
      if (trial.type === "visual" && trial.stimulus === 3) {
        trial.expectedNoResponse = true; // Should NOT press spacebar for 3
      }
    });

    // Shuffle trials randomly
    this.trialData = this.shuffleArray(trials);
    this.totalTrials = this.trialData.length;

    console.log(`Generated ${this.totalTrials} total trials:`, {
      visual: trials.filter((t) => t.type === "visual").length,
      audio1: trials.filter((t) => t.type === "audio1").length,
      audio2: trials.filter((t) => t.type === "audio2").length,
    });
    console.log("First 5 trials:", this.trialData.slice(0, 5));
  }

  /**
   * Shuffle array randomly
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Setup keyboard event handlers
   */
  setupKeyboardHandlers() {
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
    }

    this.keyHandler = (event) => {
      if (!this.awaitingResponse) return;

      event.preventDefault();

      const response = this.getResponseType(event.key);
      if (response) {
        this.handleResponse(response);
      }
    };

    document.addEventListener("keydown", this.keyHandler);
  }

  /**
   * Get response type from key press
   * @param {string} key - Pressed key
   * @returns {string|null} Response type or null
   */
  getResponseType(key) {
    switch (key) {
      case " ":
        return "spacebar";
      case "ArrowLeft":
        return "arrowleft";
      case "ArrowRight":
        return "arrowright";
      default:
        return null;
    }
  }

  /**
   * Show trial instructions
   */
  showTrialInstructions() {
    const trialType = this.isPractice ? "Practice Trial" : "Actual Experiment";
    const estimatedTime = this.calculateEstimatedTime();

    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <h1>${trialType}</h1>
                <div class="group-info">Group ${this.userGroup}</div>
                <div class="instruction-text">
                    ${
                      this.isPractice
                        ? `You will now complete ${this.totalTrials} practice trials with feedback enabled. This will help you get familiar with the task.`
                        : `You will now complete the actual experiment (${this.totalTrials} trials). This will take approximately ${estimatedTime} minutes.`
                    }
                    <br><br>
                    Remember:<br>
                    • Press SPACEBAR for all numbers except 3<br>
                    • Do NOT press anything when you see 3
                    ${
                      this.userGroup > 1
                        ? "<br>• Press ← for first audio sound"
                        : ""
                    }
                    ${
                      this.userGroup === 3
                        ? "<br>• Press → for second audio sound"
                        : ""
                    }
                </div>
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Press SPACEBAR to begin</div>
            </div>
        `;

    // Wait for spacebar to start
    const startHandler = (event) => {
      if (event.key === " ") {
        event.preventDefault();
        document.removeEventListener("keydown", startHandler);
        this.startTrial();
      }
    };

    document.addEventListener("keydown", startHandler);
  }

  /**
   * Calculate estimated time for experiment
   * @returns {number} Estimated time in minutes
   */
  calculateEstimatedTime() {
    const avgStimulusTime =
      (this.timing.stimulusMin + this.timing.stimulusMax) / 2;
    const avgTrialTime = avgStimulusTime + this.timing.fixationCross;
    const totalTime = (this.totalTrials * avgTrialTime) / 1000 / 60; // Convert to minutes

    return Math.ceil(totalTime);
  }

  /**
   * Start the current trial
   */
  startTrial() {
    if (this.currentTrial >= this.totalTrials) {
      this.endTrials();
      return;
    }

    const trial = this.trialData[this.currentTrial];
    this.currentStimulus = trial;
    this.awaitingResponse = true;
    this.stimulusStartTime = Date.now();

    // Clear screen and show stimulus
    this.showStimulus(trial);

    // Set stimulus duration
    const stimulusDuration =
      Math.random() * (this.timing.stimulusMax - this.timing.stimulusMin) +
      this.timing.stimulusMin;

    this.trialTimer = setTimeout(() => {
      this.stimulusEndTime = Date.now();
      this.endStimulus();
    }, stimulusDuration);
  }

  /**
   * Show stimulus (visual or audio)
   * @param {Object} trial - Current trial data
   */
  showStimulus(trial) {
    if (trial.type === "visual") {
      // Show number
      document.getElementById("app").innerHTML = `
                <div class="app-content">
                    <div class="stimulus-display">
                        <div class="number-stimulus">${trial.stimulus}</div>
                    </div>
                    <div class="trial-progress">Trial ${
                      this.currentTrial + 1
                    } of ${this.totalTrials}</div>
                </div>
            `;
    } else {
      // Show audio indicator and play sound
      document.getElementById("app").innerHTML = `
                <div class="app-content">
                    <div class="stimulus-display">
                        <div class="audio-stimulus">♪</div>
                    </div>
                    <div class="trial-progress">Trial ${
                      this.currentTrial + 1
                    } of ${this.totalTrials}</div>
                </div>
            `;

      // Play audio
      const audioFile =
        trial.stimulus === "sound1"
          ? this.audioFiles.sound1
          : this.audioFiles.sound2;
      audioFile.currentTime = 0;
      audioFile.play().catch((e) => console.error("Audio play failed:", e));
    }
  }

  /**
   * End stimulus presentation
   */
  endStimulus() {
    this.awaitingResponse = false;

    // If no response was given, treat as no response
    if (this.awaitingResponse === false && this.currentStimulus) {
      this.handleResponse(null);
    }
  }

  /**
   * Handle user response
   * @param {string|null} response - Response type or null for no response
   */
  handleResponse(response) {
    if (!this.currentStimulus) return;

    this.awaitingResponse = false;
    const trial = this.currentStimulus;
    const responseTime = Date.now() - this.stimulusStartTime;

    // Record stimulus end time if not already set
    if (!this.stimulusEndTime) {
      this.stimulusEndTime = Date.now();
    }

    // Clear any existing timers
    if (this.trialTimer) {
      clearTimeout(this.trialTimer);
      this.trialTimer = null;
    }

    // Determine if response was correct (for feedback only)
    let isCorrect = false;

    if (trial.type === "visual") {
      if (trial.stimulus === 3) {
        // For number 3, correct response is NO response
        isCorrect = response === null;
      } else {
        // For other numbers, correct response is spacebar
        isCorrect = response === "spacebar";
      }
    } else {
      // For audio trials, check correct key
      isCorrect = response === trial.correctResponse;
    }

    // Create trial result for data collection (actual experiment only)
    if (!this.isPractice) {
      const trialResult = {
        trialNumber: this.currentTrial + 1,
        type: trial.type,
        stimulus: trial.stimulus,
        response: response,
        responseTime: responseTime,
        stimulusStartTime: this.stimulusStartTime,
        stimulusEndTime: this.stimulusEndTime,
        correct: isCorrect, // For reference, but SDT metrics calculated in DataService
      };

      this.dataService.recordTrial(trialResult);
    }

    // Console logging (reduced as requested - remove audio2)
    if (trial.type !== "audio2") {
      console.log(`Trial ${this.currentTrial + 1}:`, {
        type: trial.type,
        stimulus: trial.stimulus,
        response: response,
        correct: isCorrect,
        rt: responseTime,
      });
    }

    // Show feedback if enabled
    if (this.feedbackEnabled) {
      this.showFeedback(isCorrect);
    } else {
      this.showFixationCross();
    }
  }

  /**
   * Show feedback for practice trials
   * @param {boolean} isCorrect - Whether response was correct
   */
  showFeedback(isCorrect) {
    const trial = this.currentStimulus;
    const feedbackColor = isCorrect ? "#10b981" : "#ef4444"; // Green or red

    if (trial.type === "visual") {
      // Show number with feedback color
      document.getElementById("app").innerHTML = `
                <div class="app-content">
                    <div class="stimulus-display">
                        <div class="number-stimulus" style="color: ${feedbackColor};">${
        trial.stimulus
      }</div>
                    </div>
                    <div class="trial-progress">Trial ${
                      this.currentTrial + 1
                    } of ${this.totalTrials}</div>
                </div>
            `;
    } else {
      // Show audio symbol with feedback color
      document.getElementById("app").innerHTML = `
                <div class="app-content">
                    <div class="stimulus-display">
                        <div class="audio-stimulus" style="color: ${feedbackColor};">♪</div>
                    </div>
                    <div class="trial-progress">Trial ${
                      this.currentTrial + 1
                    } of ${this.totalTrials}</div>
                </div>
            `;
    }

    this.feedbackTimer = setTimeout(() => {
      this.showFixationCross();
    }, this.timing.feedbackDuration);
  }

  /**
   * Show fixation cross between trials
   */
  showFixationCross() {
    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <div class="fixation-cross">+</div>
                <div class="trial-progress">Trial ${this.currentTrial + 1} of ${
      this.totalTrials
    }</div>
            </div>
        `;

    this.fixationTimer = setTimeout(() => {
      this.currentTrial++;
      this.currentStimulus = null;
      this.startTrial();
    }, this.timing.fixationCross);
  }

  /**
   * End trials and show completion
   */
  async endTrials() {
    this.cleanup();

    if (this.isPractice) {
      this.showActualExperimentPrompt();
    } else {
      // Save actual experiment data
      await this.saveExperimentData();
    }
  }

  /**
   * Save experiment data to Supabase
   */
  async saveExperimentData() {
    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <h1>Saving Data...</h1>
                <div class="group-info">Group ${this.userGroup}</div>
                <div class="instruction-text">
                    Please wait while we save your experiment data.
                    <br><br>
                    Do not close this window.
                </div>
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Saving in progress...</div>
            </div>
        `;

    try {
      const success = await this.dataService.saveExperimentData();

      if (success) {
        this.showExperimentComplete();
      } else {
        this.showSaveError();
      }
    } catch (error) {
      console.error("Error saving experiment data:", error);
      this.showSaveError();
    }
  }

  /**
   * Show save error message
   */
  showSaveError() {
    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <h1>Save Error</h1>
                <div class="group-info">Group ${this.userGroup}</div>
                <div class="instruction-text">
                    There was an error saving your data. Please contact the researcher immediately.
                    <br><br>
                    Your session ID: ${this.dataService.userUuid}
                    <br>
                    Trials completed: ${this.totalTrials}
                </div>
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Please contact researcher</div>
            </div>
        `;
  }

  /**
   * Show prompt to begin actual experiment
   */
  showActualExperimentPrompt() {
    const estimatedTime = this.calculateActualExperimentTime();

    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <h1>Practice Complete!</h1>
                <div class="group-info">Group ${this.userGroup}</div>
                <div class="instruction-text">
                    Great! You've completed the practice trials. 
                    <br><br>
                    The actual experiment will take approximately <strong>${estimatedTime} minutes</strong> and will not provide feedback.
                    <br><br>
                    Are you ready to begin the actual experiment?
                </div>
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Press SPACEBAR to continue</div>
            </div>
        `;

    // Wait for confirmation
    const confirmHandler = (event) => {
      if (event.key === " ") {
        event.preventDefault();
        document.removeEventListener("keydown", confirmHandler);
        this.showFinalConfirmation();
      }
    };

    document.addEventListener("keydown", confirmHandler);
  }

  /**
   * Show final confirmation dialog
   */
  showFinalConfirmation() {
    const estimatedTime = this.calculateActualExperimentTime();

    const overlay = document.createElement("div");
    overlay.className = "confirmation-overlay";
    overlay.innerHTML = `
            <div class="confirmation-dialog">
                <h3>Begin Actual Experiment?</h3>
                <p>The experiment will take approximately <strong>${estimatedTime} minutes</strong> to complete. Please ensure you won't be interrupted.</p>
                <div class="confirmation-buttons">
                    <button class="btn btn-secondary" onclick="this.closest('.confirmation-overlay').remove();">Not Ready</button>
                    <button class="btn btn-primary" onclick="window.trialManager.startActualExperiment(); this.closest('.confirmation-overlay').remove();">Start Experiment</button>
                </div>
            </div>
        `;

    document.body.appendChild(overlay);
    window.trialManager = this;
  }

  /**
   * Calculate actual experiment time
   * @returns {number} Estimated time in minutes
   */
  calculateActualExperimentTime() {
    const config = this.config.actual[this.userGroup];
    const totalTrials = config.visual + config.audio1 + config.audio2;
    const avgStimulusTime =
      (this.timing.stimulusMin + this.timing.stimulusMax) / 2;
    const avgTrialTime = avgStimulusTime + this.timing.fixationCross;
    const totalTime = (totalTrials * avgTrialTime) / 1000 / 60; // Convert to minutes

    return Math.ceil(totalTime);
  }

  /**
   * Start actual experiment
   */
  startActualExperiment() {
    // Get UUID from the main app for data collection
    const uuid = window.experimentApp
      ? window.experimentApp.userData?.unique_id
      : null;
    if (!uuid) {
      console.error("No UUID available for data collection");
    }

    this.init(this.userGroup, false, uuid); // false = actual experiment, pass UUID
  }

  /**
   * Show experiment complete message
   */
  showExperimentComplete() {
    document.getElementById("app").innerHTML = `
            <div class="app-content">
                <h1>Experiment Complete!</h1>
                <div class="group-info">Group ${this.userGroup}</div>
                <div class="instruction-text">
                    Thank you for participating in this experiment. 
                    <br><br>
                    You have successfully completed all ${this.totalTrials} trials.
                    <br><br>
                    Please notify the researcher that you have finished.
                </div>
            </div>
            <div class="app-footer">
                <div class="navigation-hint">Experiment Complete</div>
            </div>
        `;
  }

  /**
   * Cleanup timers and event handlers
   */
  cleanup() {
    // Remove keyboard handler
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }

    // Clear all timers
    if (this.trialTimer) {
      clearTimeout(this.trialTimer);
      this.trialTimer = null;
    }

    if (this.fixationTimer) {
      clearTimeout(this.fixationTimer);
      this.fixationTimer = null;
    }

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }

    // Reset state variables
    this.awaitingResponse = false;
    this.currentStimulus = null;
    this.stimulusStartTime = 0;

    // Stop any playing audio
    Object.values(this.audioFiles).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });

    console.log("Trial cleanup completed");
  }
}

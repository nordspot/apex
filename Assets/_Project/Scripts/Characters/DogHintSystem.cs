using System;
using UnityEngine;

namespace Apex.Characters
{
    /// <summary>
    /// Timed hint escalation system via the dog companion.
    /// Stage 1 (30s): subtle sniff toward solution.
    /// Stage 2 (60s): obvious bark at target.
    /// Stage 3 (90s): sitting at exact solution point.
    /// </summary>
    public class DogHintSystem : MonoBehaviour
    {
        public static event Action<int> OnHintStageTriggered;

        private const float HintStage1Seconds = 30f;
        private const float HintStage2Seconds = 60f;
        private const float HintStage3Seconds = 90f;

        private static DogHintSystem _instance;

        [SerializeField] private Transform _hintTarget;

        private float _idleTimer;
        private int _currentStage;
        private bool _isActive;
        private bool _isPaused;

        private void Awake()
        {
            _instance = this;
        }

        private void OnDestroy()
        {
            if (_instance == this) _instance = null;
        }

        private void Update()
        {
            if (!_isActive || _isPaused) return;

            _idleTimer += Time.deltaTime;

            if (_currentStage < 1 && _idleTimer >= HintStage1Seconds)
                TriggerHintStage(1);
            else if (_currentStage < 2 && _idleTimer >= HintStage2Seconds)
                TriggerHintStage(2);
            else if (_currentStage < 3 && _idleTimer >= HintStage3Seconds)
                TriggerHintStage(3);
        }

        /// <summary>
        /// Activate the hint system for a puzzle. Call when puzzle starts.
        /// </summary>
        public void Activate(Transform target)
        {
            _hintTarget = target;
            _idleTimer = 0f;
            _currentStage = 0;
            _isActive = true;
            _isPaused = false;
        }

        /// <summary>
        /// Deactivate when puzzle is solved.
        /// </summary>
        public void Deactivate()
        {
            _isActive = false;
            _currentStage = 0;
        }

        /// <summary>
        /// Pause hint timer (e.g., during Knowledge Clip playback).
        /// </summary>
        public void Pause() => _isPaused = true;

        /// <summary>
        /// Resume hint timer.
        /// </summary>
        public void Unpause() => _isPaused = false;

        /// <summary>
        /// Reset hint timer when player interacts with any puzzle element.
        /// Called statically from BasePuzzleController.
        /// </summary>
        public static void ResetHintTimer()
        {
            if (_instance == null || !_instance._isActive) return;

            _instance._idleTimer = 0f;
            _instance._currentStage = 0;
        }

        public Transform HintTarget => _hintTarget;
        public int CurrentStage => _currentStage;

        private void TriggerHintStage(int stage)
        {
            _currentStage = stage;
            OnHintStageTriggered?.Invoke(stage);
            Debug.Log($"[DogHint] Stage {stage} triggered at {_idleTimer:F1}s");
        }
    }
}

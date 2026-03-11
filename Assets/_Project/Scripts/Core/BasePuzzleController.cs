using System;
using UnityEngine;

namespace Apex.Core
{
    /// <summary>
    /// Abstract base for all puzzle controllers.
    /// Handles attempt tracking, hint timer integration, and completion events.
    /// </summary>
    public abstract class BasePuzzleController : MonoBehaviour
    {
        public static event Action<string, int> OnPuzzleAttempt;
        public static event Action<string, float, int> OnPuzzleSolved;

        [SerializeField] private string _puzzleId;

        public string PuzzleId => _puzzleId;
        public bool IsSolved { get; private set; }
        public int AttemptCount { get; private set; }

        private float _puzzleStartTime;

        protected virtual void OnEnable()
        {
            _puzzleStartTime = Time.time;
            AttemptCount = 0;
            IsSolved = false;
        }

        /// <summary>
        /// Call when the player makes a puzzle attempt (correct or incorrect).
        /// </summary>
        protected void RegisterAttempt(bool isCorrect)
        {
            AttemptCount++;
            OnPuzzleAttempt?.Invoke(_puzzleId, AttemptCount);

            if (isCorrect)
                SolvePuzzle();
            else
                OnAttemptFailed(AttemptCount);
        }

        private void SolvePuzzle()
        {
            if (IsSolved) return;
            IsSolved = true;

            float solveTime = Time.time - _puzzleStartTime;
            OnPuzzleSolved?.Invoke(_puzzleId, solveTime, AttemptCount);
            OnSolved(solveTime);
        }

        /// <summary>
        /// Override to provide visual/audio feedback for failed attempts.
        /// Never punish — soft rejection only.
        /// </summary>
        protected virtual void OnAttemptFailed(int attemptNumber) { }

        /// <summary>
        /// Override for puzzle-specific success celebration.
        /// </summary>
        protected virtual void OnSolved(float solveTime) { }

        /// <summary>
        /// Call when the player interacts with any puzzle element.
        /// Resets the dog hint timer.
        /// </summary>
        protected void NotifyPlayerInteraction()
        {
            // DogHintSystem listens to this via the event system
            DogHintSystem.ResetHintTimer();
        }
    }
}

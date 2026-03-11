using System;
using UnityEngine;

namespace Apex.Core
{
    /// <summary>
    /// Abstract base for all level controllers.
    /// Each level scene has one GameObject with a derived LevelController.
    /// </summary>
    public abstract class BaseLevelController : MonoBehaviour
    {
        public static event Action<int> OnLevelStarted;
        public static event Action<int, float> OnLevelCompleted;

        [SerializeField] private int _levelIndex;
        [SerializeField] private string _levelName;

        public int LevelIndex => _levelIndex;
        public string LevelName => _levelName;

        private float _levelStartTime;
        private bool _isCompleted;

        protected virtual void Start()
        {
            _levelStartTime = Time.time;
            _isCompleted = false;
            OnLevelStarted?.Invoke(_levelIndex);
            InitializeLevel();
        }

        /// <summary>
        /// Set up level-specific state (spawn points, puzzle init, etc.)
        /// </summary>
        protected abstract void InitializeLevel();

        /// <summary>
        /// Call when the level's main objective is complete.
        /// </summary>
        protected void CompleteLevel()
        {
            if (_isCompleted) return;
            _isCompleted = true;

            float duration = Time.time - _levelStartTime;
            OnLevelCompleted?.Invoke(_levelIndex, duration);
            OnLevelComplete(duration);
        }

        /// <summary>
        /// Override for level-specific completion behavior (cutscene, transition, etc.)
        /// </summary>
        protected virtual void OnLevelComplete(float duration) { }
    }
}

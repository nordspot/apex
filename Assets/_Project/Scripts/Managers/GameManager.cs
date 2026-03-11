using System;
using System.Collections.Generic;
using UnityEngine;
using Apex.Core;

namespace Apex.Managers
{
    /// <summary>
    /// Central game state manager. Controls level flow, game state, and pause.
    /// </summary>
    public class GameManager : SingletonMonoBehaviour<GameManager>
    {
        public static event Action<GameState> OnGameStateChanged;
        public static event Action<int> OnLevelLoaded;
        public static event Action OnGamePaused;
        public static event Action OnGameResumed;

        public enum GameState
        {
            Boot,
            MainMenu,
            CharacterCreation,
            IntroCinematic,
            Playing,
            Paused,
            KnowledgeClip,
            RealWorldMoment,
            LevelTransition,
            Credits
        }

        public GameState CurrentState { get; private set; } = GameState.Boot;
        public int CurrentLevel { get; private set; }
        public bool IsPaused => CurrentState == GameState.Paused;

        private GameState _stateBeforePause;

        protected override void OnInitialize()
        {
            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
        }

        /// <summary>
        /// Transition to a new game state.
        /// </summary>
        public void SetState(GameState newState)
        {
            if (CurrentState == newState) return;

            var previousState = CurrentState;
            CurrentState = newState;
            OnGameStateChanged?.Invoke(newState);

            Debug.Log($"[GameManager] State: {previousState} → {newState}");
        }

        /// <summary>
        /// Start a level by index (0-7).
        /// </summary>
        public void StartLevel(int levelIndex)
        {
            CurrentLevel = levelIndex;
            SetState(GameState.LevelTransition);

            string sceneName = $"Level_{levelIndex + 1}_{GetLevelName(levelIndex)}";
            SceneLoader.Instance.LoadSceneAsync(sceneName, () =>
            {
                SetState(GameState.Playing);
                OnLevelLoaded?.Invoke(levelIndex);
            });
        }

        public void Pause()
        {
            if (CurrentState == GameState.Paused) return;
            _stateBeforePause = CurrentState;
            Time.timeScale = 0f;
            SetState(GameState.Paused);
            OnGamePaused?.Invoke();
        }

        public void Resume()
        {
            if (CurrentState != GameState.Paused) return;
            Time.timeScale = 1f;
            SetState(_stateBeforePause);
            OnGameResumed?.Invoke();
        }

        public void ReturnToMainMenu()
        {
            Time.timeScale = 1f;
            SetState(GameState.LevelTransition);
            SceneLoader.Instance.LoadSceneAsync("MainMenu", () => SetState(GameState.MainMenu));
        }

        private string GetLevelName(int index)
        {
            return index switch
            {
                0 => "Reboot",
                1 => "Friend",
                2 => "Crossing",
                3 => "Power",
                4 => "Precision",
                5 => "Line",
                6 => "Breakthrough",
                7 => "Home",
                _ => "Unknown"
            };
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus && CurrentState == GameState.Playing)
                Pause();
        }
    }
}

using System;
using UnityEngine;
using Apex.Core;
using Apex.UI;

namespace Apex.Managers
{
    /// <summary>
    /// Manages screen-space UI visibility and navigation.
    /// Delegates to ScreenManager for stack-based screen navigation.
    /// </summary>
    public class UIManager : SingletonMonoBehaviour<UIManager>
    {
        public static event Action<string> OnScreenOpened;
        public static event Action<string> OnScreenClosed;

        [SerializeField] private ScreenManager _screenManager;

        public ScreenManager ScreenManager => _screenManager;

        protected override void OnInitialize()
        {
            if (_screenManager == null)
                _screenManager = GetComponentInChildren<ScreenManager>();
        }

        private void OnEnable()
        {
            GameManager.OnGameStateChanged += HandleGameStateChanged;
        }

        private void OnDisable()
        {
            GameManager.OnGameStateChanged -= HandleGameStateChanged;
        }

        private void HandleGameStateChanged(GameManager.GameState state)
        {
            switch (state)
            {
                case GameManager.GameState.Playing:
                    // Hide all screen-space UI, diegetic UI handles everything in-game
                    _screenManager?.CloseAll();
                    break;
                case GameManager.GameState.Paused:
                    _screenManager?.Open("PauseMenu");
                    break;
                case GameManager.GameState.MainMenu:
                    _screenManager?.Open("MainMenu");
                    break;
            }
        }

        /// <summary>
        /// Open a named screen via the ScreenManager.
        /// </summary>
        public void OpenScreen(string screenName)
        {
            _screenManager?.Open(screenName);
            OnScreenOpened?.Invoke(screenName);
        }

        /// <summary>
        /// Close the topmost screen.
        /// </summary>
        public void CloseTopScreen()
        {
            string closed = _screenManager?.CloseCurrent();
            if (closed != null)
                OnScreenClosed?.Invoke(closed);
        }
    }
}

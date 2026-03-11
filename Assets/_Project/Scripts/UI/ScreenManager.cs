using System.Collections.Generic;
using UnityEngine;

namespace Apex.UI
{
    /// <summary>
    /// Stack-based screen navigation for screen-space UI.
    /// Each "screen" is a child GameObject that gets activated/deactivated.
    /// </summary>
    public class ScreenManager : MonoBehaviour
    {
        [SerializeField] private List<ScreenEntry> _screens = new();

        private readonly Stack<string> _screenStack = new();

        [System.Serializable]
        private struct ScreenEntry
        {
            public string name;
            public GameObject root;
        }

        private void Awake()
        {
            // Ensure all screens start hidden
            foreach (var screen in _screens)
            {
                if (screen.root != null)
                    screen.root.SetActive(false);
            }
        }

        /// <summary>
        /// Open a screen by name. Hides the current top screen.
        /// </summary>
        public void Open(string screenName)
        {
            var screen = FindScreen(screenName);
            if (screen == null)
            {
                Debug.LogWarning($"[ScreenManager] Screen not found: {screenName}");
                return;
            }

            // Hide current top
            if (_screenStack.Count > 0)
            {
                var current = FindScreen(_screenStack.Peek());
                current?.SetActive(false);
            }

            screen.SetActive(true);
            _screenStack.Push(screenName);
        }

        /// <summary>
        /// Close the topmost screen. Returns the closed screen name, or null.
        /// </summary>
        public string CloseCurrent()
        {
            if (_screenStack.Count == 0) return null;

            string closedName = _screenStack.Pop();
            var closed = FindScreen(closedName);
            closed?.SetActive(false);

            // Show previous screen if any
            if (_screenStack.Count > 0)
            {
                var previous = FindScreen(_screenStack.Peek());
                previous?.SetActive(true);
            }

            return closedName;
        }

        /// <summary>
        /// Close all screens and clear the stack.
        /// </summary>
        public void CloseAll()
        {
            while (_screenStack.Count > 0)
            {
                var name = _screenStack.Pop();
                var screen = FindScreen(name);
                screen?.SetActive(false);
            }
        }

        /// <summary>
        /// Check if a screen is currently on top.
        /// </summary>
        public bool IsTopScreen(string screenName)
        {
            return _screenStack.Count > 0 && _screenStack.Peek() == screenName;
        }

        private GameObject FindScreen(string screenName)
        {
            foreach (var entry in _screens)
            {
                if (entry.name == screenName) return entry.root;
            }
            return null;
        }
    }
}

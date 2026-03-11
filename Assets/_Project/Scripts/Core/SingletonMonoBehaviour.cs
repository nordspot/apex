using UnityEngine;

namespace Apex.Core
{
    /// <summary>
    /// Generic singleton base for MonoBehaviour managers.
    /// Persists across scene loads via DontDestroyOnLoad.
    /// </summary>
    public abstract class SingletonMonoBehaviour<T> : MonoBehaviour where T : MonoBehaviour
    {
        private static T _instance;
        private static readonly object _lock = new();
        private static bool _isQuitting;

        public static T Instance
        {
            get
            {
                if (_isQuitting)
                {
                    Debug.LogWarning($"[Singleton] Instance of {typeof(T)} requested after application quit.");
                    return null;
                }

                lock (_lock)
                {
                    if (_instance != null) return _instance;

                    _instance = FindFirstObjectByType<T>();

                    if (_instance != null) return _instance;

                    var go = new GameObject($"[{typeof(T).Name}]");
                    _instance = go.AddComponent<T>();
                    DontDestroyOnLoad(go);
                    return _instance;
                }
            }
        }

        protected virtual void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }

            _instance = this as T;
            DontDestroyOnLoad(gameObject);
            OnInitialize();
        }

        protected virtual void OnDestroy()
        {
            if (_instance == this)
                _instance = null;
        }

        private void OnApplicationQuit()
        {
            _isQuitting = true;
        }

        /// <summary>
        /// Called once when the singleton initializes. Override instead of Awake.
        /// </summary>
        protected virtual void OnInitialize() { }
    }
}

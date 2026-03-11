using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using Apex.Managers;

namespace Apex.Core
{
    /// <summary>
    /// Boot scene entry point. Initializes all managers, then loads MainMenu.
    /// Attach to a GameObject in _Boot.unity.
    /// </summary>
    public class BootLoader : MonoBehaviour
    {
        [SerializeField] private float _minimumSplashDuration = 2f;

        private IEnumerator Start()
        {
            Debug.Log("[Boot] APEX starting...");

            // Force-initialize singletons in correct order
            _ = GameManager.Instance;
            _ = QualityManager.Instance;
            _ = PlayerDataManager.Instance;
            _ = AudioManager.Instance;
            _ = UIManager.Instance;
            _ = StoryManager.Instance;
            _ = AnalyticsManager.Instance;
            _ = SceneLoader.Instance;

            DeviceProfiler.LogDeviceInfo();

            Debug.Log("[Boot] All managers initialized.");

            // Hold splash screen for minimum duration
            yield return new WaitForSeconds(_minimumSplashDuration);

            // Check if player has save data to decide where to go
            bool hasSave = PlayerDataManager.Instance.Data.currentLevel > 0;

            GameManager.Instance.SetState(GameManager.GameState.LevelTransition);
            SceneLoader.Instance.LoadSceneAsync("MainMenu", () =>
            {
                GameManager.Instance.SetState(GameManager.GameState.MainMenu);
                Debug.Log("[Boot] MainMenu loaded.");
            });
        }
    }
}

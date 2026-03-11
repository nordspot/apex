using System.Collections.Generic;
using UnityEngine;

namespace Apex.Data
{
    /// <summary>
    /// ScriptableObject database of all level metadata.
    /// </summary>
    [CreateAssetMenu(fileName = "LevelDatabase", menuName = "APEX/Level Database")]
    public class LevelDatabase : ScriptableObject
    {
        [SerializeField] private List<LevelDefinition> _levels = new();

        public IReadOnlyList<LevelDefinition> Levels => _levels;

        public LevelDefinition GetLevel(int index)
        {
            if (index < 0 || index >= _levels.Count) return null;
            return _levels[index];
        }
    }

    [System.Serializable]
    public class LevelDefinition
    {
        public int levelIndex;
        public string sceneName;
        public string titleKey;         // Localization key
        public string subtitleKey;      // Localization key
        public string upgradeId;        // Which upgrade is earned
        public string linkedCareerId;
        public Sprite thumbnail;
        public float expectedDurationMinutes;
        public int knowledgeClipIndex;
    }
}

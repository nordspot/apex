using System.Collections.Generic;
using UnityEngine;

namespace Apex.Data
{
    /// <summary>
    /// ScriptableObject database of all 9 MEMO-9 upgrades.
    /// </summary>
    [CreateAssetMenu(fileName = "UpgradeDatabase", menuName = "APEX/Upgrade Database")]
    public class UpgradeDatabase : ScriptableObject
    {
        [SerializeField] private List<UpgradeDefinition> _upgrades = new();

        public IReadOnlyList<UpgradeDefinition> Upgrades => _upgrades;

        public UpgradeDefinition GetUpgrade(string upgradeId)
        {
            foreach (var upgrade in _upgrades)
            {
                if (upgrade.upgradeId == upgradeId) return upgrade;
            }
            return null;
        }
    }

    [System.Serializable]
    public class UpgradeDefinition
    {
        public string upgradeId;
        public string displayNameKey;  // Localization key
        public string descriptionKey;  // Localization key
        public int unlockedAtLevel;
        public string linkedCareerId;
        public Sprite icon;
        public GameObject visualPrefab;
    }
}

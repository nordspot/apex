using System.Collections.Generic;
using UnityEngine;

namespace Apex.Data
{
    /// <summary>
    /// ScriptableObject database of all cosmetic items (body types, colors, decals).
    /// </summary>
    [CreateAssetMenu(fileName = "CosmeticDatabase", menuName = "APEX/Cosmetic Database")]
    public class CosmeticDatabase : ScriptableObject
    {
        [SerializeField] private List<CosmeticDefinition> _cosmetics = new();

        public IReadOnlyList<CosmeticDefinition> Cosmetics => _cosmetics;

        public List<CosmeticDefinition> GetBySlot(string slot)
        {
            var result = new List<CosmeticDefinition>();
            foreach (var cosmetic in _cosmetics)
            {
                if (cosmetic.slot == slot) result.Add(cosmetic);
            }
            return result;
        }

        public CosmeticDefinition GetCosmetic(string itemId)
        {
            foreach (var cosmetic in _cosmetics)
            {
                if (cosmetic.itemId == itemId) return cosmetic;
            }
            return null;
        }
    }

    [System.Serializable]
    public class CosmeticDefinition
    {
        public string itemId;
        public string slot;             // "bodyType", "colorScheme", "decalSet", "dogOutfit"
        public string displayNameKey;   // Localization key
        public Sprite icon;
        public Color primaryColor = Color.white;
        public bool unlockedByDefault;
        public string unlockCondition;  // e.g., "level_3_complete"
    }
}

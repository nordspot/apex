using System.Collections.Generic;
using UnityEngine;

namespace Apex.Data
{
    /// <summary>
    /// ScriptableObject database of the 9 Swiss MEM careers.
    /// </summary>
    [CreateAssetMenu(fileName = "CareerDatabase", menuName = "APEX/Career Database")]
    public class CareerDatabase : ScriptableObject
    {
        [SerializeField] private List<CareerDefinition> _careers = new();

        public IReadOnlyList<CareerDefinition> Careers => _careers;

        public CareerDefinition GetCareer(string careerId)
        {
            foreach (var career in _careers)
            {
                if (career.careerId == careerId) return career;
            }
            return null;
        }
    }

    [System.Serializable]
    public class CareerDefinition
    {
        public string careerId;
        public string displayNameKey;   // Localization key
        public string descriptionKey;   // Localization key
        public Sprite icon;
        public Color accentColor;
        public string linkedUpgradeId;
        public int linkedLevelIndex;
        public string realWorldUrl;     // Link for Real-World Moments
    }
}

using System;
using System.Collections.Generic;

namespace Apex.Data
{
    [Serializable]
    public class PlayerSaveData
    {
        public int version = 1;

        // Player
        public string uuid;
        public string displayName;
        public string region;
        public string language = "de";
        public long createdAtUnixMs;

        // Robot
        public string robotName = "MEMO-9";
        public string bodyType = "compact";
        public string colorScheme = "arctic_white";
        public string decalSet = "none";
        public List<string> acquiredUpgrades = new();
        public List<string> unlockedCosmetics = new();

        // Dog
        public string dogName = "";
        public string dogOutfit = "none";
        public bool dogChipRepaired;

        // Progression
        public int currentLevel;
        public List<int> completedLevels = new();
        public Dictionary<string, string> sideQuestStatus = new();
        public List<int> watchedKnowledgeClips = new();
        public Dictionary<string, bool> realWorldMoments = new();

        // Aptitude (per career)
        public Dictionary<string, AptitudeData> aptitude = new();

        // Engagement
        public float totalPlayTimeSeconds;
        public int totalSessions;
        public long firstSessionUnixMs;
        public long lastSessionUnixMs;
    }

    [Serializable]
    public class AptitudeData
    {
        public float bestScore;
        public float totalTime;
        public int totalAttempts;
        public bool clipWatched;
    }

    [Serializable]
    public struct AptitudeSignal
    {
        public string careerId;
        public float accuracy;
        public float speed;
        public int attempts;
        public bool usedKnowledgeClip;
        public int hintsUsed;
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;
using Apex.Core;
using Apex.Data;

namespace Apex.Managers
{
    /// <summary>
    /// Manages player save data, upgrades, cosmetics, and progression.
    /// </summary>
    public class PlayerDataManager : SingletonMonoBehaviour<PlayerDataManager>
    {
        public static event Action<string> OnUpgradeAcquired;
        public static event Action<string, string> OnCosmeticChanged;
        public static event Action OnDataLoaded;
        public static event Action OnDataSaved;

        public PlayerSaveData Data { get; private set; }

        private const float AutoSaveIntervalSeconds = 30f;
        private float _lastSaveTime;

        protected override void OnInitialize()
        {
            LoadOrCreateData();
        }

        private void Update()
        {
            if (Data == null) return;

            Data.totalPlayTimeSeconds += Time.deltaTime;

            if (Time.time - _lastSaveTime >= AutoSaveIntervalSeconds)
            {
                Save();
                _lastSaveTime = Time.time;
            }
        }

        /// <summary>
        /// Grant an upgrade to MEMO-9.
        /// </summary>
        public void AcquireUpgrade(string upgradeId)
        {
            if (Data.acquiredUpgrades.Contains(upgradeId)) return;

            Data.acquiredUpgrades.Add(upgradeId);
            Save();
            OnUpgradeAcquired?.Invoke(upgradeId);
            Debug.Log($"[PlayerData] Upgrade acquired: {upgradeId}");
        }

        /// <summary>
        /// Change a cosmetic slot.
        /// </summary>
        public void SetCosmetic(string slot, string itemId)
        {
            switch (slot)
            {
                case "bodyType": Data.bodyType = itemId; break;
                case "colorScheme": Data.colorScheme = itemId; break;
                case "decalSet": Data.decalSet = itemId; break;
                case "dogOutfit": Data.dogOutfit = itemId; break;
                default:
                    Debug.LogWarning($"[PlayerData] Unknown cosmetic slot: {slot}");
                    return;
            }

            Save();
            OnCosmeticChanged?.Invoke(slot, itemId);
        }

        /// <summary>
        /// Mark a level as completed.
        /// </summary>
        public void CompleteLevel(int levelIndex, float duration)
        {
            if (!Data.completedLevels.Contains(levelIndex))
                Data.completedLevels.Add(levelIndex);

            if (levelIndex >= Data.currentLevel)
                Data.currentLevel = levelIndex + 1;

            Save();
        }

        /// <summary>
        /// Record an aptitude signal from a puzzle.
        /// </summary>
        public void RecordAptitude(AptitudeSignal signal)
        {
            if (!Data.aptitude.ContainsKey(signal.careerId))
                Data.aptitude[signal.careerId] = new AptitudeData();

            var apt = Data.aptitude[signal.careerId];
            apt.totalAttempts += signal.attempts;
            apt.totalTime += signal.speed;

            if (signal.accuracy > apt.bestScore)
                apt.bestScore = signal.accuracy;

            if (signal.usedKnowledgeClip)
                apt.clipWatched = true;

            Save();
        }

        /// <summary>
        /// Mark a Knowledge Clip as watched.
        /// </summary>
        public void WatchKnowledgeClip(int clipIndex)
        {
            if (!Data.watchedKnowledgeClips.Contains(clipIndex))
            {
                Data.watchedKnowledgeClips.Add(clipIndex);
                Save();
            }
        }

        public void Save()
        {
            if (Data == null) return;
            Data.lastSessionUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            SaveSystem.Save(Data);
            OnDataSaved?.Invoke();
        }

        private void LoadOrCreateData()
        {
            Data = SaveSystem.Load();

            if (Data == null)
            {
                Data = new PlayerSaveData
                {
                    uuid = Guid.NewGuid().ToString(),
                    createdAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    firstSessionUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                };
            }

            Data.totalSessions++;
            Data.lastSessionUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            Save();

            OnDataLoaded?.Invoke();
            Debug.Log($"[PlayerData] Loaded. UUID: {Data.uuid}, Level: {Data.currentLevel}, Sessions: {Data.totalSessions}");
        }

        private void OnApplicationQuit() => Save();
        private void OnApplicationPause(bool pause) { if (pause) Save(); }
    }
}

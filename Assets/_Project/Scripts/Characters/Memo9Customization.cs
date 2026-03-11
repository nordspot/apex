using System;
using UnityEngine;
using Apex.Managers;

namespace Apex.Characters
{
    /// <summary>
    /// Manages MEMO-9's visual appearance: color, upgrades, cosmetics.
    /// </summary>
    public class Memo9Customization : MonoBehaviour
    {
        [Header("Materials")]
        [SerializeField] private Renderer _bodyRenderer;
        [SerializeField] private Renderer _eyeRenderer;
        [SerializeField] private int _bodyMaterialIndex;

        [Header("Upgrades Container")]
        [SerializeField] private Transform _upgradesRoot;

        private static readonly int BaseColorProp = Shader.PropertyToID("_BaseColor");
        private static readonly int EmissionColorProp = Shader.PropertyToID("_EmissionColor");

        private MaterialPropertyBlock _bodyBlock;
        private MaterialPropertyBlock _eyeBlock;

        private void Awake()
        {
            _bodyBlock = new MaterialPropertyBlock();
            _eyeBlock = new MaterialPropertyBlock();
        }

        private void OnEnable()
        {
            PlayerDataManager.OnUpgradeAcquired += HandleUpgradeAcquired;
            PlayerDataManager.OnCosmeticChanged += HandleCosmeticChanged;
        }

        private void OnDisable()
        {
            PlayerDataManager.OnUpgradeAcquired -= HandleUpgradeAcquired;
            PlayerDataManager.OnCosmeticChanged -= HandleCosmeticChanged;
        }

        /// <summary>
        /// Apply all current save data visuals (call on spawn).
        /// </summary>
        public void ApplyFromSaveData()
        {
            var data = PlayerDataManager.Instance?.Data;
            if (data == null) return;

            // Apply color scheme
            ApplyColorScheme(data.colorScheme);

            // Enable acquired upgrades
            foreach (var upgradeId in data.acquiredUpgrades)
                EnableUpgradeVisual(upgradeId);
        }

        /// <summary>
        /// Set body color tint.
        /// </summary>
        public void SetBodyColor(Color color)
        {
            if (_bodyRenderer == null) return;
            _bodyRenderer.GetPropertyBlock(_bodyBlock, _bodyMaterialIndex);
            _bodyBlock.SetColor(BaseColorProp, color);
            _bodyRenderer.SetPropertyBlock(_bodyBlock, _bodyMaterialIndex);
        }

        /// <summary>
        /// Set eye emissive intensity (0-1 range, mapped to HDR emission).
        /// </summary>
        public void SetEyeIntensity(float intensity)
        {
            if (_eyeRenderer == null) return;
            Color cyan = new Color(0f, 0.898f, 1f) * intensity * 3f; // #00E5FF HDR
            _eyeRenderer.GetPropertyBlock(_eyeBlock);
            _eyeBlock.SetColor(EmissionColorProp, cyan);
            _eyeRenderer.SetPropertyBlock(_eyeBlock);
        }

        /// <summary>
        /// Enable a specific upgrade's visual child object.
        /// </summary>
        public void EnableUpgrade(string upgradeId)
        {
            EnableUpgradeVisual(upgradeId);
        }

        private void EnableUpgradeVisual(string upgradeId)
        {
            if (_upgradesRoot == null) return;

            var upgradeTransform = _upgradesRoot.Find(upgradeId);
            if (upgradeTransform != null)
                upgradeTransform.gameObject.SetActive(true);
        }

        private void HandleUpgradeAcquired(string upgradeId)
        {
            EnableUpgradeVisual(upgradeId);
        }

        private void HandleCosmeticChanged(string slot, string itemId)
        {
            if (slot == "colorScheme")
                ApplyColorScheme(itemId);
        }

        private void ApplyColorScheme(string schemeId)
        {
            // Default color schemes — driven by CosmeticDatabase in production
            Color color = schemeId switch
            {
                "arctic_white" => new Color(0.9f, 0.92f, 0.95f),
                "midnight_chrome" => new Color(0.15f, 0.15f, 0.2f),
                "alpine_blue" => new Color(0.3f, 0.5f, 0.8f),
                "sunset_orange" => new Color(0.9f, 0.5f, 0.2f),
                "forest_green" => new Color(0.2f, 0.6f, 0.3f),
                _ => Color.white
            };

            SetBodyColor(color);
        }
    }
}

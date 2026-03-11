using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Apex.Core;

namespace Apex.Managers
{
    /// <summary>
    /// Manages music and SFX playback with crossfade and pooling.
    /// </summary>
    public class AudioManager : SingletonMonoBehaviour<AudioManager>
    {
        public static event Action<string> OnMusicChanged;

        [SerializeField] private int _sfxPoolSize = 8;
        [SerializeField] private float _musicCrossfadeDuration = 1.5f;

        private AudioSource _musicSourceA;
        private AudioSource _musicSourceB;
        private AudioSource _activeMusicSource;
        private readonly List<AudioSource> _sfxPool = new();
        private readonly Dictionary<string, AudioClip> _clipCache = new();

        private float _masterVolume = 1f;
        private float _musicVolume = 0.7f;
        private float _sfxVolume = 1f;

        public float MasterVolume
        {
            get => _masterVolume;
            set { _masterVolume = Mathf.Clamp01(value); UpdateVolumes(); }
        }

        public float MusicVolume
        {
            get => _musicVolume;
            set { _musicVolume = Mathf.Clamp01(value); UpdateVolumes(); }
        }

        public float SfxVolume
        {
            get => _sfxVolume;
            set => _sfxVolume = Mathf.Clamp01(value);
        }

        protected override void OnInitialize()
        {
            _musicSourceA = CreateAudioSource("MusicA");
            _musicSourceA.loop = true;

            _musicSourceB = CreateAudioSource("MusicB");
            _musicSourceB.loop = true;
            _musicSourceB.volume = 0f;

            _activeMusicSource = _musicSourceA;

            for (int i = 0; i < _sfxPoolSize; i++)
            {
                var sfx = CreateAudioSource($"SFX_{i}");
                _sfxPool.Add(sfx);
            }
        }

        /// <summary>
        /// Play a music track with crossfade. Pass null to stop music.
        /// </summary>
        public void PlayMusic(AudioClip clip)
        {
            if (clip == null)
            {
                StartCoroutine(FadeOut(_activeMusicSource, _musicCrossfadeDuration));
                return;
            }

            var incoming = _activeMusicSource == _musicSourceA ? _musicSourceB : _musicSourceA;
            incoming.clip = clip;
            incoming.Play();

            StartCoroutine(CrossfadeCoroutine(_activeMusicSource, incoming, _musicCrossfadeDuration));
            _activeMusicSource = incoming;

            OnMusicChanged?.Invoke(clip.name);
        }

        /// <summary>
        /// Play a music track by resource path.
        /// </summary>
        public void PlayMusic(string clipPath)
        {
            var clip = LoadClip(clipPath);
            if (clip != null) PlayMusic(clip);
        }

        /// <summary>
        /// Play a sound effect. Returns the AudioSource for optional control.
        /// </summary>
        public AudioSource PlaySFX(AudioClip clip, float volumeScale = 1f)
        {
            if (clip == null) return null;

            var source = GetAvailableSfxSource();
            source.clip = clip;
            source.volume = _sfxVolume * _masterVolume * volumeScale;
            source.Play();
            return source;
        }

        /// <summary>
        /// Play a sound effect by resource path.
        /// </summary>
        public AudioSource PlaySFX(string clipPath, float volumeScale = 1f)
        {
            var clip = LoadClip(clipPath);
            return clip != null ? PlaySFX(clip, volumeScale) : null;
        }

        /// <summary>
        /// Play a sound effect at a world position (3D spatialized).
        /// </summary>
        public void PlaySFXAtPoint(AudioClip clip, Vector3 position, float volumeScale = 1f)
        {
            if (clip == null) return;
            AudioSource.PlayClipAtPoint(clip, position, _sfxVolume * _masterVolume * volumeScale);
        }

        private AudioSource GetAvailableSfxSource()
        {
            foreach (var source in _sfxPool)
            {
                if (!source.isPlaying) return source;
            }

            // All busy — steal the oldest
            return _sfxPool[0];
        }

        private IEnumerator CrossfadeCoroutine(AudioSource outgoing, AudioSource incoming, float duration)
        {
            float elapsed = 0f;
            float targetVolume = _musicVolume * _masterVolume;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = elapsed / duration;
                outgoing.volume = Mathf.Lerp(targetVolume, 0f, t);
                incoming.volume = Mathf.Lerp(0f, targetVolume, t);
                yield return null;
            }

            outgoing.Stop();
            outgoing.volume = 0f;
            incoming.volume = targetVolume;
        }

        private IEnumerator FadeOut(AudioSource source, float duration)
        {
            float startVolume = source.volume;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                source.volume = Mathf.Lerp(startVolume, 0f, elapsed / duration);
                yield return null;
            }

            source.Stop();
            source.volume = 0f;
        }

        private void UpdateVolumes()
        {
            if (_activeMusicSource != null)
                _activeMusicSource.volume = _musicVolume * _masterVolume;
        }

        private AudioSource CreateAudioSource(string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform);
            return go.AddComponent<AudioSource>();
        }

        private AudioClip LoadClip(string path)
        {
            if (_clipCache.TryGetValue(path, out var cached))
                return cached;

            var clip = Resources.Load<AudioClip>(path);
            if (clip != null)
                _clipCache[path] = clip;
            else
                Debug.LogWarning($"[AudioManager] Clip not found: {path}");

            return clip;
        }
    }
}

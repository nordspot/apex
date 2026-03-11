using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using System.IO;

/// <summary>
/// One-click project setup for APEX.
/// Creates URP pipeline assets, boot scene, main menu scene, and configures graphics.
/// Menu: APEX → Setup Project
/// </summary>
public class APEXProjectSetup : EditorWindow
{
    [MenuItem("APEX/Setup Entire Project %#&s")]
    public static void ShowWindow()
    {
        GetWindow<APEXProjectSetup>("APEX Setup").Show();
    }

    private Vector2 _scroll;
    private string _log = "";

    private void OnGUI()
    {
        EditorGUILayout.LabelField("APEX Project Setup", EditorStyles.boldLabel);
        EditorGUILayout.Space();

        if (GUILayout.Button("1. Create URP Pipeline Assets", GUILayout.Height(30)))
            CreateURPAssets();

        if (GUILayout.Button("2. Configure Graphics Settings", GUILayout.Height(30)))
            ConfigureGraphics();

        if (GUILayout.Button("3. Create Boot Scene (_Boot)", GUILayout.Height(30)))
            CreateBootScene();

        if (GUILayout.Button("4. Create Main Menu Scene", GUILayout.Height(30)))
            CreateMainMenuScene();

        if (GUILayout.Button("5. Create Level 1 Scene (Reboot)", GUILayout.Height(30)))
            CreateLevel1Scene();

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("", GUI.skin.horizontalSlider);

        if (GUILayout.Button("RUN ALL STEPS", GUILayout.Height(40)))
        {
            _log = "";
            CreateURPAssets();
            ConfigureGraphics();
            CreateBootScene();
            CreateMainMenuScene();
            CreateLevel1Scene();
            UpdateBuildSettings();
            Log("All steps complete!");
        }

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("Log:", EditorStyles.boldLabel);
        _scroll = EditorGUILayout.BeginScrollView(_scroll);
        EditorGUILayout.TextArea(_log, GUILayout.ExpandHeight(true));
        EditorGUILayout.EndScrollView();
    }

    // ─────────────────────────────────────────────
    // STEP 1: URP Pipeline Assets
    // ─────────────────────────────────────────────

    private void CreateURPAssets()
    {
        EnsureDirectory("Assets/Settings");

        // Create Forward Renderer
        var rendererData = ScriptableObject.CreateInstance<UniversalRendererData>();
        AssetDatabase.CreateAsset(rendererData, "Assets/Settings/URP_Renderer_Forward.asset");
        Log("Created URP_Renderer_Forward.asset");

        // Low Quality
        var low = CreateURPAsset("URP_LowQuality", rendererData);
        ConfigureURPAsset(low, URPQuality.Low);
        Log("Created URP_LowQuality.asset");

        // Medium Quality
        var medium = CreateURPAsset("URP_MediumQuality", rendererData);
        ConfigureURPAsset(medium, URPQuality.Medium);
        Log("Created URP_MediumQuality.asset");

        // High Quality
        var high = CreateURPAsset("URP_HighQuality", rendererData);
        ConfigureURPAsset(high, URPQuality.High);
        Log("Created URP_HighQuality.asset");

        // Assign to Quality Settings
        var qualityLevels = QualitySettings.names;
        for (int i = 0; i < qualityLevels.Length; i++)
        {
            RenderPipelineAsset asset = qualityLevels[i] switch
            {
                "Low" => low,
                "Medium" => medium,
                "High" => high,
                _ => medium
            };
            QualitySettings.SetQualityLevel(i, false);
            QualitySettings.renderPipeline = asset;
        }

        // Set default
        GraphicsSettings.defaultRenderPipeline = medium;
        QualitySettings.SetQualityLevel(1, true); // Default to Medium

        AssetDatabase.SaveAssets();
        Log("URP pipeline assets assigned to Quality Settings.");
    }

    private UniversalRenderPipelineAsset CreateURPAsset(string name, ScriptableRendererData rendererData)
    {
        var asset = UniversalRenderPipelineAsset.Create(rendererData);
        AssetDatabase.CreateAsset(asset, $"Assets/Settings/{name}.asset");
        return asset;
    }

    private enum URPQuality { Low, Medium, High }

    private void ConfigureURPAsset(UniversalRenderPipelineAsset asset, URPQuality quality)
    {
        switch (quality)
        {
            case URPQuality.Low:
                asset.renderScale = 0.75f;
                asset.supportsHDR = false;
                asset.msaaSampleCount = 1;
                asset.shadowDistance = 30f;
                break;

            case URPQuality.Medium:
                asset.renderScale = 1f;
                asset.supportsHDR = true;
                asset.msaaSampleCount = 2;
                asset.shadowDistance = 50f;
                break;

            case URPQuality.High:
                asset.renderScale = 1f;
                asset.supportsHDR = true;
                asset.msaaSampleCount = 4;
                asset.shadowDistance = 80f;
                break;
        }

        EditorUtility.SetDirty(asset);
    }

    // ─────────────────────────────────────────────
    // STEP 2: Graphics Settings
    // ─────────────────────────────────────────────

    private void ConfigureGraphics()
    {
        // Ensure linear color space
        PlayerSettings.colorSpace = ColorSpace.Linear;
        Log("Color space: Linear");

        // Target frame rate
        Application.targetFrameRate = 60;

        // Mobile orientation
        PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
        Log("Orientation: Portrait");

        // Company & product
        PlayerSettings.companyName = "Faszination Technik";
        PlayerSettings.productName = "APEX";
        Log("Company: Faszination Technik, Product: APEX");

        // Bundle IDs
        PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, "com.faszinationtechnik.apex");
        PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.iOS, "com.faszinationtechnik.apex");
        Log("Bundle IDs set for Android & iOS");

        // Android settings
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel25;
        PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions)34;
        Log("Android: min SDK 24, target SDK 34");

        // iOS settings
        PlayerSettings.iOS.targetOSVersionString = "15.0";
        Log("iOS: minimum 15.0");

        // Scripting backend
        PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
        PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.iOS, ScriptingImplementation.IL2CPP);
        Log("Scripting backend: IL2CPP (Android & iOS)");

        // Static batching
        // SetBatchingForPlatform is handled by PlayerSettings in the asset

        Log("Graphics configured.");
    }

    // ─────────────────────────────────────────────
    // STEP 3: Boot Scene
    // ─────────────────────────────────────────────

    private void CreateBootScene()
    {
        EnsureDirectory("Assets/_Project/Scenes");

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // --- Managers GameObject ---
        var managers = new GameObject("[Managers]");

        // Camera (minimal — just for boot splash)
        var camGO = new GameObject("Boot Camera");
        var cam = camGO.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.06f, 0.06f, 0.08f); // Near-black

        // Fade Canvas
        var fadeGO = CreateFadeCanvas();

        // Boot Loader
        var bootGO = new GameObject("[BootLoader]");
        bootGO.AddComponent<Apex.Core.BootLoader>();
        Log("Added BootLoader component");

        // Save scene
        string path = "Assets/_Project/Scenes/_Boot.unity";
        EditorSceneManager.SaveScene(scene, path);
        Log($"Boot scene saved: {path}");
    }

    // ─────────────────────────────────────────────
    // STEP 4: Main Menu Scene
    // ─────────────────────────────────────────────

    private void CreateMainMenuScene()
    {
        EnsureDirectory("Assets/_Project/Scenes");

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // Main Camera with URP
        var camGO = new GameObject("Main Camera");
        camGO.tag = "MainCamera";
        var cam = camGO.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.Skybox;
        camGO.AddComponent<UniversalAdditionalCameraData>();

        // Directional Light
        var lightGO = new GameObject("Directional Light");
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Directional;
        light.color = new Color(1f, 0.95f, 0.85f); // Warm sunrise
        light.intensity = 1.2f;
        lightGO.transform.eulerAngles = new Vector3(50f, -30f, 0f);
        lightGO.AddComponent<UniversalAdditionalLightData>();

        // UI Canvas
        var canvasGO = new GameObject("UI Canvas");
        var canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvasGO.AddComponent<UnityEngine.UI.CanvasScaler>();
        var scaler = canvasGO.GetComponent<UnityEngine.UI.CanvasScaler>();
        scaler.uiScaleMode = UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;
        canvasGO.AddComponent<UnityEngine.UI.GraphicRaycaster>();

        // Title Text
        var titleGO = new GameObject("Title");
        titleGO.transform.SetParent(canvasGO.transform, false);
        var titleText = titleGO.AddComponent<UnityEngine.UI.Text>();
        titleText.text = "A P E X";
        titleText.fontSize = 72;
        titleText.alignment = TextAnchor.MiddleCenter;
        titleText.color = Color.white;
        titleText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        var titleRect = titleGO.GetComponent<RectTransform>();
        titleRect.anchorMin = new Vector2(0.1f, 0.7f);
        titleRect.anchorMax = new Vector2(0.9f, 0.85f);
        titleRect.offsetMin = Vector2.zero;
        titleRect.offsetMax = Vector2.zero;

        // Subtitle
        var subGO = new GameObject("Subtitle");
        subGO.transform.SetParent(canvasGO.transform, false);
        var subText = subGO.AddComponent<UnityEngine.UI.Text>();
        subText.text = "Finde deinen Weg.";
        subText.fontSize = 28;
        subText.alignment = TextAnchor.MiddleCenter;
        subText.color = new Color(0f, 0.898f, 1f); // Cyan #00E5FF
        subText.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        var subRect = subGO.GetComponent<RectTransform>();
        subRect.anchorMin = new Vector2(0.2f, 0.65f);
        subRect.anchorMax = new Vector2(0.8f, 0.72f);
        subRect.offsetMin = Vector2.zero;
        subRect.offsetMax = Vector2.zero;

        // Play Button
        CreateUIButton(canvasGO.transform, "Play Button", "SPIELEN", new Vector2(0.25f, 0.35f), new Vector2(0.75f, 0.42f),
            new Color(0f, 0.898f, 1f));

        // Continue Button (hidden by default)
        var continueBtn = CreateUIButton(canvasGO.transform, "Continue Button", "FORTSETZEN", new Vector2(0.25f, 0.45f), new Vector2(0.75f, 0.52f),
            new Color(0f, 0.898f, 1f));
        continueBtn.SetActive(false);

        // EventSystem
        var eventSystem = new GameObject("EventSystem");
        eventSystem.AddComponent<UnityEngine.EventSystems.EventSystem>();
        eventSystem.AddComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>();

        // Environment placeholder
        var envGO = new GameObject("--- Environment ---");
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Ground";
        ground.transform.SetParent(envGO.transform);
        ground.transform.localScale = new Vector3(10f, 1f, 10f);

        string path = "Assets/_Project/Scenes/MainMenu.unity";
        EditorSceneManager.SaveScene(scene, path);
        Log($"MainMenu scene saved: {path}");
    }

    // ─────────────────────────────────────────────
    // STEP 5: Level 1 Scene
    // ─────────────────────────────────────────────

    private void CreateLevel1Scene()
    {
        EnsureDirectory("Assets/_Project/Scenes/Levels");

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // --- CAMERAS ---
        var camGO = new GameObject("Main Camera");
        camGO.tag = "MainCamera";
        var cam = camGO.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.Skybox;
        camGO.AddComponent<UniversalAdditionalCameraData>();
        camGO.transform.position = new Vector3(0f, 3f, -8f);
        camGO.transform.eulerAngles = new Vector3(15f, 0f, 0f);

        // --- LIGHTING ---
        var lightGO = new GameObject("Directional Light (Dawn Sun)");
        var light = lightGO.AddComponent<Light>();
        light.type = LightType.Directional;
        light.color = new Color(1f, 0.8f, 0.6f); // Dawn golden
        light.intensity = 1.5f;
        lightGO.transform.eulerAngles = new Vector3(15f, 45f, 0f);
        lightGO.AddComponent<UniversalAdditionalLightData>();

        // --- ENVIRONMENT ---
        var envGO = new GameObject("--- Environment ---");

        // Snow ground
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Snow Ground";
        ground.transform.SetParent(envGO.transform);
        ground.transform.localScale = new Vector3(5f, 1f, 5f);
        // Set white material for snow
        var groundRenderer = ground.GetComponent<Renderer>();
        var snowMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        snowMat.color = new Color(0.95f, 0.96f, 0.98f);
        groundRenderer.sharedMaterial = snowMat;
        EnsureDirectory("Assets/_Project/Art/Materials/Environment");
        AssetDatabase.CreateAsset(snowMat, "Assets/_Project/Art/Materials/Environment/M_Snow.mat");

        // Rock outcrops (placeholder cubes)
        for (int i = 0; i < 5; i++)
        {
            var rock = GameObject.CreatePrimitive(PrimitiveType.Cube);
            rock.name = $"Rock_{i}";
            rock.transform.SetParent(envGO.transform);
            rock.transform.position = new Vector3(
                Random.Range(-15f, 15f), Random.Range(0.3f, 1.5f), Random.Range(-15f, 15f));
            rock.transform.localScale = new Vector3(
                Random.Range(1f, 3f), Random.Range(0.5f, 2f), Random.Range(1f, 3f));
            rock.transform.eulerAngles = new Vector3(0f, Random.Range(0f, 360f), 0f);
            rock.isStatic = true;
        }

        // --- CHARACTERS ---
        var charsGO = new GameObject("--- Characters ---");

        // MEMO-9 (placeholder capsule until model is ready)
        var memo9GO = new GameObject("MEMO-9");
        memo9GO.transform.SetParent(charsGO.transform);
        memo9GO.transform.position = new Vector3(0f, 0f, 0f);
        memo9GO.layer = LayerMask.NameToLayer("Characters");

        var bodyGO = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        bodyGO.name = "Body";
        bodyGO.transform.SetParent(memo9GO.transform);
        bodyGO.transform.localPosition = new Vector3(0f, 1f, 0f);
        bodyGO.transform.localScale = new Vector3(0.6f, 0.6f, 0.6f);
        var bodyRenderer = bodyGO.GetComponent<Renderer>();
        var bodyMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        bodyMat.color = new Color(0.9f, 0.92f, 0.95f); // Arctic white
        bodyRenderer.sharedMaterial = bodyMat;
        EnsureDirectory("Assets/_Project/Art/Materials/MEMO9");
        AssetDatabase.CreateAsset(bodyMat, "Assets/_Project/Art/Materials/MEMO9/M_Memo9_Base.mat");

        // Eyes (emissive cyan spheres)
        var eyesMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        eyesMat.color = new Color(0f, 0.898f, 1f);
        eyesMat.EnableKeyword("_EMISSION");
        eyesMat.SetColor("_EmissionColor", new Color(0f, 0.898f, 1f) * 2f);
        AssetDatabase.CreateAsset(eyesMat, "Assets/_Project/Art/Materials/MEMO9/M_Memo9_Eyes.mat");

        var leftEye = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        leftEye.name = "Eye_L";
        leftEye.transform.SetParent(memo9GO.transform);
        leftEye.transform.localPosition = new Vector3(-0.12f, 1.45f, 0.25f);
        leftEye.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f);
        leftEye.GetComponent<Renderer>().sharedMaterial = eyesMat;

        var rightEye = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        rightEye.name = "Eye_R";
        rightEye.transform.SetParent(memo9GO.transform);
        rightEye.transform.localPosition = new Vector3(0.12f, 1.45f, 0.25f);
        rightEye.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f);
        rightEye.GetComponent<Renderer>().sharedMaterial = eyesMat;

        // Upgrades container
        var upgradesGO = new GameObject("Upgrades");
        upgradesGO.transform.SetParent(memo9GO.transform);

        // Interaction zone
        var interactZone = new GameObject("InteractionZone");
        interactZone.transform.SetParent(memo9GO.transform);
        interactZone.transform.localPosition = new Vector3(0f, 1f, 0.8f);
        var triggerCollider = interactZone.AddComponent<SphereCollider>();
        triggerCollider.isTrigger = true;
        triggerCollider.radius = 0.5f;

        // Add MEMO-9 components
        var cc = memo9GO.AddComponent<CharacterController>();
        cc.center = new Vector3(0f, 1f, 0f);
        cc.height = 1.2f;
        cc.radius = 0.3f;
        memo9GO.AddComponent<Apex.Characters.Memo9Controller>();
        memo9GO.AddComponent<Apex.Characters.Memo9Interaction>();
        memo9GO.AddComponent<Apex.Characters.Memo9Customization>();
        Log("MEMO-9 placeholder created with controller components");

        // --- PUZZLE ---
        var puzzleGO = new GameObject("--- Puzzle ---");

        // Scattered robot parts (Level 1: Assembly Puzzle)
        string[] partNames = { "Servo Motor", "Neural Wiring", "Chassis Panel",
            "Optical Lens", "Power Cell", "Circuit Board", "Antenna", "Joint Actuator", "Core Processor" };

        for (int i = 0; i < partNames.Length; i++)
        {
            var part = GameObject.CreatePrimitive(PrimitiveType.Cube);
            part.name = $"Part_{partNames[i].Replace(" ", "")}";
            part.transform.SetParent(puzzleGO.transform);

            float angle = i * (360f / partNames.Length) * Mathf.Deg2Rad;
            float radius = Random.Range(3f, 8f);
            part.transform.position = new Vector3(
                Mathf.Cos(angle) * radius,
                0.3f,
                Mathf.Sin(angle) * radius
            );
            part.transform.localScale = new Vector3(0.4f, 0.4f, 0.4f);
            part.transform.eulerAngles = new Vector3(
                Random.Range(-15f, 15f), Random.Range(0f, 360f), Random.Range(-15f, 15f));

            // Tag as interactable
            part.tag = "Interactable";
            part.layer = LayerMask.NameToLayer("Interactable");

            // Cyan highlight material
            var partMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            partMat.color = new Color(0.6f, 0.65f, 0.7f); // Metallic grey
            part.GetComponent<Renderer>().sharedMaterial = partMat;
        }

        Log("9 puzzle parts created for Assembly Puzzle");

        // Crash debris
        var debrisGO = new GameObject("Crash Debris");
        debrisGO.transform.SetParent(envGO.transform);
        for (int i = 0; i < 8; i++)
        {
            var debris = GameObject.CreatePrimitive(
                i % 2 == 0 ? PrimitiveType.Cube : PrimitiveType.Cylinder);
            debris.name = $"Debris_{i}";
            debris.transform.SetParent(debrisGO.transform);
            debris.transform.position = new Vector3(
                Random.Range(-5f, 5f), Random.Range(0f, 0.5f), Random.Range(-5f, 5f));
            debris.transform.localScale = new Vector3(
                Random.Range(0.2f, 0.8f), Random.Range(0.1f, 0.4f), Random.Range(0.2f, 0.8f));
            debris.transform.eulerAngles = new Vector3(
                Random.Range(-30f, 30f), Random.Range(0f, 360f), Random.Range(-30f, 30f));
            debris.isStatic = true;
        }

        // --- TRIGGERS ---
        var triggersGO = new GameObject("--- Triggers ---");

        var clipTrigger = new GameObject("KnowledgeClipTrigger");
        clipTrigger.transform.SetParent(triggersGO.transform);
        clipTrigger.transform.position = new Vector3(5f, 0f, 5f);
        var clipCol = clipTrigger.AddComponent<BoxCollider>();
        clipCol.isTrigger = true;
        clipCol.size = new Vector3(3f, 3f, 3f);
        clipTrigger.tag = "KnowledgeClipTrigger";

        var exitTrigger = new GameObject("LevelExitTrigger");
        exitTrigger.transform.SetParent(triggersGO.transform);
        exitTrigger.transform.position = new Vector3(0f, 0f, 20f);
        var exitCol = exitTrigger.AddComponent<BoxCollider>();
        exitCol.isTrigger = true;
        exitCol.size = new Vector3(5f, 5f, 2f);
        exitTrigger.tag = "LevelExit";

        // --- NAV MESH (bake surface) ---
        var navSurface = ground.AddComponent<Unity.AI.Navigation.NavMeshSurface>();
        Log("NavMeshSurface added to ground (bake in editor)");

        // Save
        string path = "Assets/_Project/Scenes/Levels/Level_1_Reboot.unity";
        EditorSceneManager.SaveScene(scene, path);
        Log($"Level 1 scene saved: {path}");

        AssetDatabase.SaveAssets();
    }

    // ─────────────────────────────────────────────
    // Build Settings
    // ─────────────────────────────────────────────

    private void UpdateBuildSettings()
    {
        var scenes = new EditorBuildSettingsScene[]
        {
            new("Assets/_Project/Scenes/_Boot.unity", true),
            new("Assets/_Project/Scenes/MainMenu.unity", true),
            new("Assets/_Project/Scenes/Levels/Level_1_Reboot.unity", true),
        };
        EditorBuildSettings.scenes = scenes;
        Log("Build settings updated with 3 scenes.");
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    private GameObject CreateFadeCanvas()
    {
        var canvasGO = new GameObject("Fade Canvas");
        var canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 100;

        var cg = canvasGO.AddComponent<CanvasGroup>();
        cg.alpha = 0f;
        cg.blocksRaycasts = false;

        var imageGO = new GameObject("Fade Image");
        imageGO.transform.SetParent(canvasGO.transform, false);
        var image = imageGO.AddComponent<UnityEngine.UI.Image>();
        image.color = Color.black;
        var rect = imageGO.GetComponent<RectTransform>();
        rect.anchorMin = Vector2.zero;
        rect.anchorMax = Vector2.one;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;

        return canvasGO;
    }

    private GameObject CreateUIButton(Transform parent, string name, string label,
        Vector2 anchorMin, Vector2 anchorMax, Color color)
    {
        var btnGO = new GameObject(name);
        btnGO.transform.SetParent(parent, false);

        var image = btnGO.AddComponent<UnityEngine.UI.Image>();
        image.color = new Color(color.r, color.g, color.b, 0.15f);

        var btn = btnGO.AddComponent<UnityEngine.UI.Button>();

        var rect = btnGO.GetComponent<RectTransform>();
        rect.anchorMin = anchorMin;
        rect.anchorMax = anchorMax;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;

        // Button label
        var textGO = new GameObject("Label");
        textGO.transform.SetParent(btnGO.transform, false);
        var text = textGO.AddComponent<UnityEngine.UI.Text>();
        text.text = label;
        text.fontSize = 32;
        text.alignment = TextAnchor.MiddleCenter;
        text.color = color;
        text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        var textRect = textGO.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;

        return btnGO;
    }

    private void EnsureDirectory(string path)
    {
        if (!AssetDatabase.IsValidFolder(path))
        {
            string parent = Path.GetDirectoryName(path).Replace("\\", "/");
            string folder = Path.GetFileName(path);
            if (!AssetDatabase.IsValidFolder(parent))
                EnsureDirectory(parent);
            AssetDatabase.CreateFolder(parent, folder);
        }
    }

    private void Log(string msg)
    {
        _log += $"[{System.DateTime.Now:HH:mm:ss}] {msg}\n";
        Debug.Log($"[APEX Setup] {msg}");
    }
}

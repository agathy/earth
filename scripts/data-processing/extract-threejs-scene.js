/**
 * Three.js Scene Extractor
 * 在浏览器控制台运行，提取地球场景配置
 */

(function() {
    'use strict';
    
    console.log('🌍 Three.js Scene Extractor v1.0');
    console.log('=====================================');
    
    const extraction = {
        timestamp: new Date().toISOString(),
        threeJsVersion: window.THREE?.REVISION || 'not found',
        scenes: [],
        cameras: [],
        renderers: [],
        materials: [],
        geometries: [],
        textures: []
    };

    // 1. 查找所有Three.js对象
    function findThreeJSObjects() {
        const objects = [];
        
        // 遍历window对象查找Three.js实例
        for (let key in window) {
            try {
                const obj = window[key];
                if (obj && typeof obj === 'object') {
                    // 检测Scene
                    if (obj.isScene) {
                        objects.push({ type: 'Scene', name: obj.name || key, ref: obj });
                    }
                    // 检测Camera
                    if (obj.isCamera) {
                        objects.push({ type: 'Camera', name: obj.name || key, ref: obj });
                    }
                    // 检测Renderer
                    if (obj.isWebGLRenderer) {
                        objects.push({ type: 'Renderer', name: key, ref: obj });
                    }
                }
            } catch (e) {
                // 忽略访问错误
            }
        }
        
        return objects;
    }

    // 2. 提取场景结构
    function extractScene(scene) {
        const sceneData = {
            name: scene.name,
            children: [],
            background: scene.background,
            fog: scene.fog,
            environment: scene.environment
        };
        
        scene.traverse((obj) => {
            const objData = {
                type: obj.type,
                name: obj.name,
                uuid: obj.uuid,
                visible: obj.visible,
                position: obj.position?.toArray(),
                rotation: obj.rotation?.toArray(),
                scale: obj.scale?.toArray(),
                userData: obj.userData
            };
            
            // 提取材质
            if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                objData.materials = mats.map(mat => extractMaterial(mat));
            }
            
            // 提取几何体
            if (obj.geometry) {
                objData.geometry = extractGeometry(obj.geometry);
            }
            
            sceneData.children.push(objData);
        });
        
        return sceneData;
    }

    // 3. 提取材质
    function extractMaterial(material) {
        if (!material) return null;
        
        return {
            type: material.type,
            name: material.name,
            uuid: material.uuid,
            color: material.color?.getHexString(),
            emissive: material.emissive?.getHexString(),
            roughness: material.roughness,
            metalness: material.metalness,
            transparent: material.transparent,
            opacity: material.opacity,
            side: material.side,
            wireframe: material.wireframe,
            map: material.map ? extractTexture(material.map) : null,
            normalMap: material.normalMap ? extractTexture(material.normalMap) : null,
            specularMap: material.specularMap ? extractTexture(material.specularMap) : null
        };
    }

    // 4. 提取几何体
    function extractGeometry(geometry) {
        if (!geometry) return null;
        
        return {
            type: geometry.type,
            name: geometry.name,
            uuid: geometry.uuid,
            parameters: geometry.parameters,
            vertexCount: geometry.attributes?.position?.count,
            hasNormals: !!geometry.attributes?.normal,
            hasUVs: !!geometry.attributes?.uv,
            boundingSphere: geometry.boundingSphere ? {
                center: geometry.boundingSphere.center.toArray(),
                radius: geometry.boundingSphere.radius
            } : null
        };
    }

    // 5. 提取纹理
    function extractTexture(texture) {
        if (!texture) return null;
        
        return {
            type: texture.type,
            name: texture.name,
            uuid: texture.uuid,
            image: texture.image ? {
                src: texture.image.src,
                width: texture.image.width,
                height: texture.image.height
            } : null,
            wrapS: texture.wrapS,
            wrapT: texture.wrapT,
            repeat: texture.repeat?.toArray(),
            offset: texture.offset?.toArray()
        };
    }

    // 6. 提取相机
    function extractCamera(camera) {
        return {
            type: camera.type,
            name: camera.name,
            uuid: camera.uuid,
            position: camera.position?.toArray(),
            rotation: camera.rotation?.toArray(),
            fov: camera.fov,
            near: camera.near,
            far: camera.far,
            zoom: camera.zoom,
            aspect: camera.aspect
        };
    }

    // 7. 提取渲染器
    function extractRenderer(renderer) {
        return {
            type: renderer.type,
            parameters: renderer.parameters,
            pixelRatio: renderer.getPixelRatio(),
            size: renderer.getSize(new THREE.Vector2()).toArray(),
            capabilities: {
                maxTextures: renderer.capabilities.maxTextures,
                maxVertexTextures: renderer.capabilities.maxVertexTextures,
                maxTextureSize: renderer.capabilities.maxTextureSize,
                maxCubemapSize: renderer.capabilities.maxCubemapSize,
                maxAttributes: renderer.capabilities.maxAttributes,
                maxVertexUniforms: renderer.capabilities.maxVertexUniforms,
                maxVaryings: renderer.capabilities.maxVaryings,
                maxFragmentUniforms: renderer.capabilities.maxFragmentUniforms,
                vertexTextures: renderer.capabilities.vertexTextures,
                floatFragmentTextures: renderer.capabilities.floatFragmentTextures,
                floatVertexTextures: renderer.capabilities.floatVertexTextures
            }
        };
    }

    // 主提取函数
    function extractAll() {
        console.log('\n🔍 Scanning for Three.js objects...');
        
        const objects = findThreeJSObjects();
        console.log(`Found ${objects.length} Three.js objects`);
        
        objects.forEach(obj => {
            console.log(`  - ${obj.type}: ${obj.name}`);
            
            switch (obj.type) {
                case 'Scene':
                    extraction.scenes.push(extractScene(obj.ref));
                    break;
                case 'Camera':
                    extraction.cameras.push(extractCamera(obj.ref));
                    break;
                case 'Renderer':
                    extraction.renderers.push(extractRenderer(obj.ref));
                    break;
            }
        });
        
        // 显示结果
        console.log('\n📊 Extraction Results:');
        console.log('======================');
        console.log(`Scenes: ${extraction.scenes.length}`);
        console.log(`Cameras: ${extraction.cameras.length}`);
        console.log(`Renderers: ${extraction.renderers.length}`);
        
        if (extraction.scenes.length > 0) {
            const scene = extraction.scenes[0];
            console.log(`\nScene "${scene.name}" contains ${scene.children.length} objects`);
            
            // 按类型统计
            const types = {};
            scene.children.forEach(child => {
                types[child.type] = (types[child.type] || 0) + 1;
            });
            
            console.log('\nObject types:');
            Object.entries(types).forEach(([type, count]) => {
                console.log(`  - ${type}: ${count}`);
            });
        }
        
        // 保存到全局变量
        window._threeExtraction = extraction;
        
        console.log('\n✅ Extraction complete!');
        console.log('Access via window._threeExtraction');
        console.log('Run downloadExtraction() to save as JSON');
        
        return extraction;
    }

    // 下载功能
    window.downloadExtraction = function() {
        const dataStr = JSON.stringify(window._threeExtraction, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `threejs-extraction-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        console.log('💾 Downloaded!');
    };

    // 自动运行
    if (window.THREE) {
        console.log('✓ Three.js detected (v' + window.THREE.REVISION + ')');
        setTimeout(extractAll, 1000); // 延迟1秒确保场景已加载
    } else {
        console.log('⚠ Three.js not detected. Make sure to run this on a page with Three.js');
    }
})();

import * as THREE from 'three';
import { globalTexture } from '@/src/utils/textures';

const vertexShader = `
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vViewPosition;
    varying vec3 vNormal;

    uniform float uTime;

    void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec3 pos = worldPosition.xyz;
        float wave = sin(pos.x * 0.5 + uTime) * 0.1 + cos(pos.z * 0.4 + uTime * 0.8) * 0.1;
        vec3 newPos = position;
        newPos.y += wave * 0.5;
        vElevation = wave;
        vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
        vViewPosition = -mvPosition.xyz;
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fragmentShader = `
    uniform sampler2D uTexture;
    uniform vec3 uSunColor;
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vViewPosition;
    varying vec3 vNormal;

    void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        vec3 waterColor = vec3(0.0, 0.4, 0.7);
        vec3 finalColor = mix(waterColor, texColor.rgb, 0.3);
        finalColor += vElevation * 0.1;
        vec3 viewDir = normalize(vViewPosition);
        vec3 normal = normalize(vNormal);
        float fresnelTerm = pow(clamp(1.0 - dot(viewDir, normal), 0.0, 1.0), 3.0);
        finalColor = mix(finalColor, uSunColor, fresnelTerm * 0.6);
        gl_FragColor = vec4(finalColor, 0.75);
    }
`;

// Singleton shared across ALL water meshes — uTime updated once per frame in Scene.tsx
export const sharedWaterMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime:     { value: 0 },
        uTexture:  { value: globalTexture },
        uSunColor: { value: new THREE.Color('#ffffee') },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
});

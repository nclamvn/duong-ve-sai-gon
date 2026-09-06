/**
 * Thực vật (TIP-D05): scatter seeded → batch instanced theo ô + LOD + impostor 8 hướng + gió TSL + collider thân.
 * Chỉ scatter.ts chạy được trong Node (unit test); phần còn lại cần three/webgpu.
 */
export { scatterSpecies, placementColliders, valueNoise2, fbm2, type ScatterRule, type ScatterRect, type SpeciesPlacement } from './scatter';
export { loadSpecies, type SpeciesAsset, type SpeciesVariant, type SpeciesLod, type SpeciesPart, type SpeciesMaterialDef } from './species';
export { createVegetationMaterial, createWindUniforms, instancedWindPosition, type WindUniforms, type VegMaterialOptions } from './material';
export { bakeImpostorAtlas, createImpostorBatch, type ImpostorAtlas, type ImpostorBatch } from './impostor';
export { VegetationSystem, type VegetationDef, type VegetationQuality, type VegetationStats } from './system';
export { buildForest, VEG_QUALITY, type ForestBuild, type ForestOptions } from './forest';
export { navObstacleMesh, type NavObstacleMesh } from './navObstacles';

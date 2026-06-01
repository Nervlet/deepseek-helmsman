import { IMAGE_MODELS } from "./image-models.generated.ts";
import type { ImagesApi, ImagesModel } from "./types.ts";

const imageModelRegistry: Map<string, Map<string, ImagesModel<ImagesApi>>> = new Map();
const imageModels = IMAGE_MODELS as Record<string, Record<string, ImagesModel<ImagesApi>>>;

for (const [provider, models] of Object.entries(imageModels)) {
	const providerModels = new Map<string, ImagesModel<ImagesApi>>();
	for (const [id, model] of Object.entries(models)) {
		providerModels.set(id, model);
	}
	imageModelRegistry.set(provider, providerModels);
}

export function getImageModel(provider: string, modelId: string): ImagesModel<ImagesApi> {
	const providerModels = imageModelRegistry.get(provider);
	return providerModels?.get(modelId) as ImagesModel<ImagesApi>;
}

export function getImageProviders(): string[] {
	return Array.from(imageModelRegistry.keys());
}

export function getImageModels(provider: string): ImagesModel<ImagesApi>[] {
	const models = imageModelRegistry.get(provider);
	return models ? Array.from(models.values()) : [];
}

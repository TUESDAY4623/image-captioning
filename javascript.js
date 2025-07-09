// Example of how it works:
const predictions = await this.model.classify(img);
const features = {
    objects: predictions.map(p => p.className),
    confidence: predictions.map(p => p.probability),
    dominantObject: predictions[0]?.className
};

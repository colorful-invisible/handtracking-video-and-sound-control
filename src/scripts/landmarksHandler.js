export const getMappedLandmarks = (sk, mediaPipe, camFeed, indices) => {
  const mappedLandmarks = {};

  if (mediaPipe.landmarks.length > 0 && mediaPipe.landmarks[0]) {
    indices.forEach((index) => {
      if (mediaPipe.landmarks[0][index]) {
        const landmarkNameX = `LM${index}X`;
        const landmarkNameY = `LM${index}Y`;

        mappedLandmarks[landmarkNameX] = sk.map(
          mediaPipe.landmarks[0][index].x,
          1,
          0,
          0,
          camFeed.scaledWidth
        );

        mappedLandmarks[landmarkNameY] = sk.map(
          mediaPipe.landmarks[0][index].y,
          0,
          1,
          0,
          camFeed.scaledHeight
        );
      }
    });
  }

  return mappedLandmarks;
};

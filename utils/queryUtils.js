export const buildQuery = (query, { page = 1, limit = 10, sortBy = "createdAt", order = "desc", userCoordinates = null }) => {
  const skip = (page - 1) * limit;
  const sortOrder = order === "asc" ? 1 : -1;
  const sortStage = {};

  if (sortBy === "price") {
    sortStage["prices.price"] = sortOrder;
  } else {
    sortStage[sortBy] = sortOrder;
  }

  sortStage["_id"] = 1;

  query.sort(sortStage).skip(skip).limit(parseInt(limit));

  if (sortBy === "distance" && userCoordinates && query.constructor.name !== "Aggregate") {
    query.where("location.coordinates").near({
      center: {
        type: "Point",
        coordinates: userCoordinates,
      },
      spherical: true,
      maxDistance: 1000000, // 1000km
    });
  }

  return query;
};

export const buildQuery = (query, { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', userCoordinates = null }) => {
    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortStage = {};

    // Determine the primary sort key based on the 'sortBy' parameter
    if (sortBy === 'price') {
        // Special case for sorting by nested price
        sortStage['prices.price'] = sortOrder;
    } else {
        // Default sort for any other field like 'createdAt'
        sortStage[sortBy] = sortOrder;
    }

    // CRITICAL FIX: Add a unique and consistent secondary sort key as a tie-breaker.
    // This guarantees a stable order for all documents, fixing the pagination issue.
    sortStage['_id'] = 1; // Always sort by ID ascending as a tie-breaker

    // The .sort(), .skip(), and .limit() methods work on both Mongoose Query and Aggregate objects.
    query.sort(sortStage).skip(skip).limit(parseInt(limit));

    // Special handling for distance sorting (for non-aggregation queries)
    if (sortBy === 'distance' && userCoordinates && query.constructor.name !== 'Aggregate') {
        query.where('location.coordinates').near({
            center: {
                type: 'Point',
                coordinates: userCoordinates,
            },
            spherical: true,
            maxDistance: 1000000, // 1000km
        });
    }

    return query;
};
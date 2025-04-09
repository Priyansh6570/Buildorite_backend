export const buildQuery = (query, { page = 1, limit = 10, sortBy = 'price', order = 'asc', userCoordinates = null }) => {
    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;
  
    // Pagination
    query.skip(skip).limit(parseInt(limit));
  
    // Sorting by price (for materials)
    if (sortBy === 'price') {
      query.sort({ 'prices.price': sortOrder });
    }

    // filtering by role (for users)
    // if (role) {
    //   query.where('role').equals(role);
    // }
  
    // Sorting by distance (for mines)
    if (sortBy === 'distance' && userCoordinates) {
      query = query.where('location.coordinates').near({
        center: {
          type: 'Point',
          coordinates: userCoordinates,
        },
        spherical: true,
        maxDistance: 1000000,
      });
    }
  
    return query;
  };  
export const searchFields = {
    mine: [
      { field: 'name', isRef: false },
      { field: 'location.address', isRef: false },
      { field: 'owner_id', isRef: true, refField: 'name', refModel: 'User' },
    ],
    material: [
      { field: 'name', isRef: false },
      { field: 'mine_id', isRef: true, refField: 'name', refModel: 'Mine' },
    ],
    user: [
      { field: 'name', isRef: false },
      { field: 'phone', isRef: false },
      { field: 'mine_id', isRef: true, refField: 'name', refModel: 'Mine' },
    ],
};
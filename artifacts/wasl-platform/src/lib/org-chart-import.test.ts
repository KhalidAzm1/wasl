import { describe, expect, it } from 'vitest';
import { mergeContactsIntoOrgChart } from './org-chart-import';

describe('mergeContactsIntoOrgChart', () => {
  it('keeps the existing hierarchy and photo when matching contacts are imported', () => {
    const result = mergeContactsIntoOrgChart(
      [
        {
          id: 'director',
          name: 'Muhanad Almanae',
          title: 'Director',
          parentId: null,
          photoUrl: 'https://signed.example/photo.jpg',
          photoStoragePath: 'org-chart/BANK-002/director.jpg',
        },
        {
          id: 'manager',
          name: 'Sultan Alsabban',
          title: 'Manager',
          parentId: 'director',
          photoUrl: null,
        },
      ],
      [
        { name: 'Muhanad Almanae', title: 'Technology Director', phone: '0500000000' },
        { name: 'Sultan Alsabban', title: 'Manager', manager: 'Muhanad Almanae' },
      ],
      (index) => `new-${index}`,
    );

    expect(result.added).toBe(0);
    expect(result.updated).toBe(2);
    expect(result.nodes).toEqual([
      expect.objectContaining({
        id: 'director',
        title: 'Technology Director',
        parentId: null,
        photoUrl: 'https://signed.example/photo.jpg',
        photoStoragePath: 'org-chart/BANK-002/director.jpg',
      }),
      expect.objectContaining({ id: 'manager', parentId: 'director' }),
    ]);
  });

  it('adds new contacts without deleting existing manual chart nodes', () => {
    const result = mergeContactsIntoOrgChart(
      [{ id: 'manual', name: 'Existing Person', parentId: null, photoUrl: 'photo' }],
      [
        { name: 'Existing Person' },
        { name: 'New Person', manager: 'Existing Person', phone: '0555555555' },
      ],
      (index) => `new-${index}`,
    );

    expect(result.added).toBe(1);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({ id: 'manual', photoUrl: 'photo' });
    expect(result.nodes[1]).toMatchObject({ id: 'new-0', parentId: 'manual', photoUrl: null });
  });

  it('updates an existing person when only the phone format or name changed', () => {
    const result = mergeContactsIntoOrgChart(
      [{
        id: 'existing',
        name: 'Old Contact Name',
        phone: '+966 50 123 4567',
        parentId: null,
        photoUrl: 'photo',
      }],
      [{
        name: 'Updated Contact Name',
        phone: '0501234567',
        title: 'Updated role',
      }],
      (index) => `new-${index}`,
    );

    expect(result.added).toBe(0);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: 'existing',
      name: 'Updated Contact Name',
      phone: '0501234567',
      title: 'Updated role',
      photoUrl: 'photo',
    });
  });
});
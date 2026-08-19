export type OrgChartImportNode = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  parentId?: string | null;
  photoUrl?: string | null;
  photoStoragePath?: string | null;
};

export type OrgChartImportContact = {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  manager?: string | null;
};

const normaliseName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * Treat Saudi local and international spellings as the same number:
 * 0501234567, +966 501234567, and 00966501234567 all become 501234567.
 */
const normalisePhone = (value: string | null | undefined) => {
  let digits = (value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00966')) digits = digits.slice(5);
  else if (digits.startsWith('966')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

/**
 * Safely brings contact details into an existing organization chart.
 *
 * Existing node IDs, reporting lines, and image references are deliberately
 * retained. Only new contacts receive a new chart node and a parent inferred
 * from the contact's manager field.
 */
export function mergeContactsIntoOrgChart(
  nodes: OrgChartImportNode[],
  contacts: OrgChartImportContact[],
  createId: (index: number) => string,
) {
  const next = nodes.map((node) => ({ ...node }));
  const byName = new Map(next.map((node) => [normaliseName(node.name), node]));
  const byPhone = new Map<string, OrgChartImportNode>();

  for (const node of next) {
    const phone = normalisePhone(node.phone);
    if (phone) byPhone.set(phone, node);
  }

  const additions: Array<{ node: OrgChartImportNode; contact: OrgChartImportContact }> = [];
  let updated = 0;

  for (const contact of contacts) {
    const cleanName = contact.name.trim();
    if (!cleanName) continue;

    const contactPhone = normalisePhone(contact.phone);
    // Phone is the strongest identity signal. Check it first so a renamed
    // contact cannot create a duplicate node after a chart restore.
    const existing = (contactPhone ? byPhone.get(contactPhone) : undefined)
      ?? byName.get(normaliseName(cleanName));

    if (existing) {
      Object.assign(existing, {
        name: cleanName,
        title: contact.title ?? existing.title ?? null,
        phone: contact.phone ?? existing.phone ?? null,
        email: contact.email ?? existing.email ?? null,
        department: contact.department ?? existing.department ?? null,
      });
      // photoUrl, photoStoragePath, id, and parentId are intentionally preserved.
      byName.set(normaliseName(cleanName), existing);
      const phone = normalisePhone(existing.phone);
      if (phone) byPhone.set(phone, existing);
      updated += 1;
      continue;
    }

    const node: OrgChartImportNode = {
      id: createId(additions.length),
      name: cleanName,
      title: contact.title ?? null,
      phone: contact.phone ?? null,
      email: contact.email ?? null,
      department: contact.department ?? null,
      parentId: null,
      photoUrl: null,
      photoStoragePath: null,
    };
    additions.push({ node, contact });
    next.push(node);
    byName.set(normaliseName(cleanName), node);
    const phone = normalisePhone(node.phone);
    if (phone) byPhone.set(phone, node);
  }

  // Only new entries receive a hierarchy inferred from contacts. Existing
  // manual relationships are never overwritten by an import.
  for (const { node, contact } of additions) {
    const manager = contact.manager?.trim();
    if (!manager) continue;
    const parent = byName.get(normaliseName(manager));
    if (parent && parent.id !== node.id) node.parentId = parent.id;
  }

  return { nodes: next, added: additions.length, updated };
}
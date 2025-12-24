// Disjoint Set Union (DSU) or Union-Find data structure
export class DSU {
  parent: Map<string, string>;
  size: Map<string, number>;
  members: Map<string, string[]>;

  constructor() {
    this.parent = new Map();
    this.size = new Map();
    this.members = new Map();
  }

  make(item: string) {
    if (!this.parent.has(item)) {
      this.parent.set(item, item);
      this.size.set(item, 1);
      this.members.set(item, [item]);
    }
  }

  find(item: string): string {
    if (this.parent.get(item) === item) {
      return item;
    }
    const root = this.find(this.parent.get(item)!);
    this.parent.set(item, root);
    return root;
  }

  union(itemA: string, itemB: string) {
    const rootA = this.find(itemA);
    const rootB = this.find(itemB);

    if (rootA !== rootB) {
      if ((this.size.get(rootA) ?? 1) < (this.size.get(rootB) ?? 1)) {
        this.parent.set(rootA, rootB);
        this.size.set(rootB, (this.size.get(rootA) ?? 1) + (this.size.get(rootB) ?? 1));
        const membersA = this.members.get(rootA) || [];
        const membersB = this.members.get(rootB) || [];
        this.members.set(rootB, [...membersB, ...membersA]);
        this.members.delete(rootA);
      } else {
        this.parent.set(rootB, rootA);
        this.size.set(rootA, (this.size.get(rootA) ?? 1) + (this.size.get(rootB) ?? 1));
        const membersA = this.members.get(rootA) || [];
        const membersB = this.members.get(rootB) || [];
        this.members.set(rootA, [...membersA, ...membersB]);
        this.members.delete(rootB);
      }
    }
  }

  getGroups(): Map<string, string[]> {
    return this.members;
  }
}

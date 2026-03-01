export function buildRiskDocumentation() {
  return {
    risks: [
      {
        category: "Data Integrity",
        description: "Name manipulation or duplication risk",
        mitigation: "Advanced Difference Engine + Cluster Engine",
      },
      {
        category: "Fraud Detection",
        description: "Identity modification attempt",
        mitigation: "Root similarity + structural penalty",
      },
      {
        category: "Operational Risk",
        description: "Database corruption",
        mitigation: "Transactional batch inserts + WAL mode",
      },
      {
        category: "Access Control",
        description: "Unauthorized manipulation",
        mitigation: "API-only database access",
      },
    ],
  };
}

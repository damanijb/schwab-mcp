// Account aliases from Damani's portfolio — also used as a generic resolver
export interface AccountInfo {
  num: string;
  hash: string;
  label: string;
}

const ACCOUNTS: Record<string, AccountInfo> = {
  brownfam: {
    num: "72559737",
    hash: "8068DD3EC9AC7A14CB2037FB81AFA7570F1C1320CC23E530C63EF62A29CFB36A",
    label: "Brown Fam ...737 (P1)",
  },
  brownjoint: {
    num: "44952733",
    hash: "49DAD429F62041FB4C0D3648C51FC350B457A5B0817BCFEE6F74FBEF3BB29397",
    label: "Brown Joint ...733 (P1)",
  },
  "tarina-spec": {
    num: "19038328",
    hash: "33BCC20EF6DDCDEF15432CD07F1F6938B265C5402CAD318FA7EFB5F9F9D41364",
    label: "Tarina Brokerage ...328 (P2)",
  },
  "tarina-roth": {
    num: "23609156",
    hash: "8F9C361DF7DB99BD4F9ECEEBEC19B8968506767F0BDC1498F548444685645E82",
    label: "Tarina Roth IRA ...156 (P3)",
  },
  "tarina-ret1": {
    num: "73358794",
    hash: "669B1C247B799CD44250DE95EDA0E7DD5D3C51B5CDB560CD0B01E5AF7F5A48D8",
    label: "Tarina Retirement 1 ...794 (P4)",
  },
  "tarina-ret2": {
    num: "59091425",
    hash: "6845A5A562D882D2496F62F8134B48EC6DBBAFAAAF4A166F8201929E5E5E6159",
    label: "Tarina Retirement 2 ...425 (P5)",
  },
};

const ALIASES: Record<string, string[]> = {
  all: Object.keys(ACCOUNTS),
  p1: ["brownfam", "brownjoint"],
  p2: ["tarina-spec"],
  p3: ["tarina-roth"],
  p4: ["tarina-ret1"],
  p5: ["tarina-ret2"],
  damani: ["brownfam", "brownjoint"],
  tarina: ["tarina-spec", "tarina-roth", "tarina-ret1", "tarina-ret2"],
};

export function resolveAccounts(names: string[]): AccountInfo[] {
  const seen = new Set<string>();
  const result: AccountInfo[] = [];

  for (const name of names) {
    const lower = name.toLowerCase();
    const keys = ALIASES[lower] || (ACCOUNTS[lower] ? [lower] : null);
    if (!keys) {
      throw new Error(
        `Unknown account "${name}". Valid: ${[...Object.keys(ACCOUNTS), ...Object.keys(ALIASES)].join(", ")}`
      );
    }
    for (const key of keys) {
      if (!seen.has(key)) {
        seen.add(key);
        result.push(ACCOUNTS[key]);
      }
    }
  }
  return result;
}

export function resolveAccountHash(nameOrHash: string): string {
  const lower = nameOrHash.toLowerCase();
  if (ACCOUNTS[lower]) return ACCOUNTS[lower].hash;
  // Check if it's already a hash
  if (nameOrHash.length === 64 && /^[A-F0-9]+$/i.test(nameOrHash)) return nameOrHash;
  // Check aliases (take first)
  if (ALIASES[lower]) return ACCOUNTS[ALIASES[lower][0]].hash;
  throw new Error(`Unknown account "${nameOrHash}"`);
}

export function getAccountLabel(hash: string): string {
  for (const acct of Object.values(ACCOUNTS)) {
    if (acct.hash === hash) return acct.label;
  }
  return hash.substring(0, 8) + "...";
}

export { ACCOUNTS, ALIASES };

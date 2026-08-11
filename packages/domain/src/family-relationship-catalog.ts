import type { RelationType } from './app-data.js';

export type FamilyRelationshipCategory = 'core' | 'ancestor' | 'descendant' | 'sibling' | 'extended' | 'in_law' | 'care' | 'other';

export type FamilyRelationshipCode =
  | 'mother' | 'father' | 'parent' | 'step_mother' | 'step_father' | 'foster_parent'
  | 'spouse' | 'former_spouse' | 'fiance'
  | 'daughter' | 'son' | 'child' | 'step_child' | 'adopted_child'
  | 'sister' | 'brother' | 'sibling' | 'step_sibling'
  | 'grandmother' | 'grandfather' | 'grandparent' | 'granddaughter' | 'grandson' | 'grandchild'
  | 'great_grandmother' | 'great_grandfather' | 'great_grandchild'
  | 'aunt_paternal' | 'uncle_paternal' | 'aunt_maternal' | 'uncle_maternal'
  | 'niece' | 'nephew' | 'cousin'
  | 'daughter_in_law' | 'son_in_law' | 'sibling_husband' | 'sibling_wife' | 'brother_in_law' | 'sister_in_law' | 'spouse_sister'
  | 'mother_in_law' | 'father_in_law' | 'co_sister_in_law' | 'co_brother_in_law'
  | 'guardian' | 'caregiver' | 'family_friend' | 'other';

export interface FamilyRelationshipCatalogItem {
  readonly code: FamilyRelationshipCode;
  readonly label: string;
  readonly reciprocalLabel: string;
  readonly category: FamilyRelationshipCategory;
  readonly forwardRelationType: RelationType;
  readonly reverseRelationType: RelationType;
  readonly referenceRequired: boolean;
}

export const FAMILY_RELATIONSHIP_CATALOG: readonly FamilyRelationshipCatalogItem[] = Object.freeze([
  { code:'mother', label:'Anne', reciprocalLabel:'Çocuk', category:'core', forwardRelationType:'parent', reverseRelationType:'child', referenceRequired:true },
  { code:'father', label:'Baba', reciprocalLabel:'Çocuk', category:'core', forwardRelationType:'parent', reverseRelationType:'child', referenceRequired:true },
  { code:'parent', label:'Ebeveyn', reciprocalLabel:'Çocuk', category:'core', forwardRelationType:'parent', reverseRelationType:'child', referenceRequired:true },
  { code:'step_mother', label:'Üvey anne', reciprocalLabel:'Üvey çocuk', category:'core', forwardRelationType:'parent', reverseRelationType:'child', referenceRequired:true },
  { code:'step_father', label:'Üvey baba', reciprocalLabel:'Üvey çocuk', category:'core', forwardRelationType:'parent', reverseRelationType:'child', referenceRequired:true },
  { code:'foster_parent', label:'Koruyucu ebeveyn', reciprocalLabel:'Koruyucu aile çocuğu', category:'care', forwardRelationType:'guardian', reverseRelationType:'other', referenceRequired:true },
  { code:'spouse', label:'Eş', reciprocalLabel:'Eş', category:'core', forwardRelationType:'spouse', reverseRelationType:'spouse', referenceRequired:true },
  { code:'former_spouse', label:'Eski eş', reciprocalLabel:'Eski eş', category:'core', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'fiance', label:'Nişanlı', reciprocalLabel:'Nişanlı', category:'core', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'daughter', label:'Kız', reciprocalLabel:'Ebeveyn', category:'descendant', forwardRelationType:'child', reverseRelationType:'parent', referenceRequired:true },
  { code:'son', label:'Oğul', reciprocalLabel:'Ebeveyn', category:'descendant', forwardRelationType:'child', reverseRelationType:'parent', referenceRequired:true },
  { code:'child', label:'Çocuk', reciprocalLabel:'Ebeveyn', category:'descendant', forwardRelationType:'child', reverseRelationType:'parent', referenceRequired:true },
  { code:'step_child', label:'Üvey çocuk', reciprocalLabel:'Üvey ebeveyn', category:'descendant', forwardRelationType:'child', reverseRelationType:'parent', referenceRequired:true },
  { code:'adopted_child', label:'Evlatlık', reciprocalLabel:'Ebeveyn', category:'descendant', forwardRelationType:'child', reverseRelationType:'parent', referenceRequired:true },
  { code:'sister', label:'Kız kardeş', reciprocalLabel:'Kardeş', category:'sibling', forwardRelationType:'sibling', reverseRelationType:'sibling', referenceRequired:true },
  { code:'brother', label:'Erkek kardeş', reciprocalLabel:'Kardeş', category:'sibling', forwardRelationType:'sibling', reverseRelationType:'sibling', referenceRequired:true },
  { code:'sibling', label:'Kardeş', reciprocalLabel:'Kardeş', category:'sibling', forwardRelationType:'sibling', reverseRelationType:'sibling', referenceRequired:true },
  { code:'step_sibling', label:'Üvey kardeş', reciprocalLabel:'Üvey kardeş', category:'sibling', forwardRelationType:'sibling', reverseRelationType:'sibling', referenceRequired:true },
  { code:'grandmother', label:'Büyükanne', reciprocalLabel:'Torun', category:'ancestor', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'grandfather', label:'Büyükbaba', reciprocalLabel:'Torun', category:'ancestor', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'grandparent', label:'Büyük ebeveyn', reciprocalLabel:'Torun', category:'ancestor', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'granddaughter', label:'Kız torun', reciprocalLabel:'Büyük ebeveyn', category:'descendant', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'grandson', label:'Erkek torun', reciprocalLabel:'Büyük ebeveyn', category:'descendant', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'grandchild', label:'Torun', reciprocalLabel:'Büyük ebeveyn', category:'descendant', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'great_grandmother', label:'Büyük büyükanne', reciprocalLabel:'Torunun çocuğu', category:'ancestor', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'great_grandfather', label:'Büyük büyükbaba', reciprocalLabel:'Torunun çocuğu', category:'ancestor', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'great_grandchild', label:'Torunun çocuğu', reciprocalLabel:'Büyük büyük ebeveyn', category:'descendant', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'aunt_paternal', label:'Hala', reciprocalLabel:'Yeğen', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'uncle_paternal', label:'Amca', reciprocalLabel:'Yeğen', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'aunt_maternal', label:'Teyze', reciprocalLabel:'Yeğen', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'uncle_maternal', label:'Dayı', reciprocalLabel:'Yeğen', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'niece', label:'Kız yeğen', reciprocalLabel:'Amca, dayı, hala veya teyze', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'nephew', label:'Erkek yeğen', reciprocalLabel:'Amca, dayı, hala veya teyze', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'cousin', label:'Kuzen', reciprocalLabel:'Kuzen', category:'extended', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'daughter_in_law', label:'Gelin', reciprocalLabel:'Kayınvalide veya kayınpeder', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'son_in_law', label:'Damat', reciprocalLabel:'Kayınvalide veya kayınpeder', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'sibling_husband', label:'Enişte', reciprocalLabel:'Baldız veya kayınbirader', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'sibling_wife', label:'Yenge', reciprocalLabel:'Görümce veya kayınbirader', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'brother_in_law', label:'Kayınbirader', reciprocalLabel:'Enişte, yenge veya kayınbirader', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'sister_in_law', label:'Baldız', reciprocalLabel:'Enişte', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'spouse_sister', label:'Görümce', reciprocalLabel:'Yenge veya enişte', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'mother_in_law', label:'Kayınvalide', reciprocalLabel:'Gelin veya damat', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'father_in_law', label:'Kayınpeder', reciprocalLabel:'Gelin veya damat', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'co_sister_in_law', label:'Elti', reciprocalLabel:'Elti', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'co_brother_in_law', label:'Bacanak', reciprocalLabel:'Bacanak', category:'in_law', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'guardian', label:'Vasi', reciprocalLabel:'Vesayet altındaki kişi', category:'care', forwardRelationType:'guardian', reverseRelationType:'other', referenceRequired:true },
  { code:'caregiver', label:'Bakıcı', reciprocalLabel:'Bakım alan kişi', category:'care', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'family_friend', label:'Aile dostu', reciprocalLabel:'Aile dostu', category:'other', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:true },
  { code:'other', label:'Diğer', reciprocalLabel:'Diğer', category:'other', forwardRelationType:'other', reverseRelationType:'other', referenceRequired:false }
]);

const byCode = new Map(FAMILY_RELATIONSHIP_CATALOG.map((item) => [item.code, item] as const));

export const getFamilyRelationship = (code: FamilyRelationshipCode): FamilyRelationshipCatalogItem | undefined => byCode.get(code);
export const isFamilyRelationshipCode = (value: unknown): value is FamilyRelationshipCode => typeof value === 'string' && byCode.has(value as FamilyRelationshipCode);

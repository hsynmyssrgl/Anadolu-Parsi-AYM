import type {
  FamilyEmergencyAssistanceItemType,
  FamilyEmergencyCardPortabilityItemType,
  FamilyEmergencyItemType,
  FamilyEmergencyPreparednessItemType,
  ManagedHomeInventoryItemType,
  ManagedLifeCategory
} from '@ppt/domain';

export const MANAGED_LIFE_INPUT_KEYS = Object.freeze({
  profile: Object.freeze([
    'itemType','ownerPersonId','category','title','status','privacy','details',
    'startsAt','endsAt','initialReminder','financeAssetId'
  ]),
  activity: Object.freeze([
    'itemType','recordId','activityKind','occurredAt','provider','amountMinor','currency',
    'quantityMilliunits','odometerKm','financeExpenseId','reminderMutation','note'
  ]),
  document: Object.freeze([
    'itemType','recordId','archiveItemId','documentKind','label'
  ])
} as const);

export const MANAGED_LIFE_REQUIRED_INPUT_KEYS = Object.freeze({
  profile: Object.freeze(['itemType','ownerPersonId','category','title','status','privacy','details']),
  activity: Object.freeze(['itemType','recordId','activityKind','occurredAt']),
  document: Object.freeze(['itemType','recordId','archiveItemId','documentKind'])
} as const);

export const MANAGED_LIFE_PROFILE_DETAIL_KEYS = Object.freeze({
  insurance: Object.freeze(['insuranceKind','provider']),
  subscription: Object.freeze(['provider','planName','billingCycle']),
  education: Object.freeze(['institution','program']),
  employment: Object.freeze(['employer','position']),
  official_operation: Object.freeze(['authority','operationType']),
  home: Object.freeze(['tenure','propertyType','addressLabel']),
  vehicle: Object.freeze(['vehicleType','energyType','plate'])
} satisfies Readonly<Record<ManagedLifeCategory, readonly string[]>>);

export const MANAGED_LIFE_PROFILE_REQUIRED_DETAIL_KEYS = Object.freeze({
  insurance: Object.freeze(['insuranceKind','provider']),
  subscription: Object.freeze(['provider','planName','billingCycle']),
  education: Object.freeze(['institution','program']),
  employment: Object.freeze(['employer','position']),
  official_operation: Object.freeze(['authority','operationType']),
  home: Object.freeze(['tenure','propertyType','addressLabel']),
  vehicle: Object.freeze(['vehicleType','energyType'])
} satisfies Readonly<Record<ManagedLifeCategory, readonly string[]>>);

export const MANAGED_LIFE_INITIAL_REMINDER_KEYS = Object.freeze(['kind','dueAt'] as const);
export const MANAGED_LIFE_REMINDER_MUTATION_KEYS = Object.freeze({
  set: Object.freeze(['action','kind','dueAt']),
  clear: Object.freeze(['action'])
} as const);

export const MANAGED_HOME_INVENTORY_INPUT_KEYS = Object.freeze({
  room: Object.freeze(['itemType','recordId','supersedesItemId','name','roomKind']),
  meter: Object.freeze(['itemType','recordId','supersedesItemId','roomId','label','meterKind','readingUnit']),
  meter_reading: Object.freeze([
    'itemType','recordId','supersedesItemId','meterId','readingKind','readingMilliunits','recordedAt','note'
  ]),
  belonging: Object.freeze([
    'itemType','recordId','supersedesItemId','roomId','name','belongingKind','serialNumber',
    'purchasedAt','purchaseAmountMinor','currency','financeExpenseId'
  ]),
  warranty: Object.freeze([
    'itemType','recordId','supersedesItemId','belongingId','provider','startsAt','endsAt','reminderAt','note'
  ]),
  service: Object.freeze([
    'itemType','recordId','supersedesItemId','targetItemId','targetType','serviceKind','occurredAt',
    'provider','amountMinor','currency','financeExpenseId','note'
  ]),
  document: Object.freeze([
    'itemType','recordId','supersedesItemId','targetItemId','targetType','archiveItemId','documentKind','label'
  ])
} satisfies Readonly<Record<ManagedHomeInventoryItemType, readonly string[]>>);

export const MANAGED_HOME_INVENTORY_REQUIRED_INPUT_KEYS = Object.freeze({
  room: Object.freeze(['itemType','recordId','name','roomKind']),
  meter: Object.freeze(['itemType','recordId','label','meterKind','readingUnit']),
  meter_reading: Object.freeze([
    'itemType','recordId','meterId','readingKind','readingMilliunits','recordedAt'
  ]),
  belonging: Object.freeze(['itemType','recordId','name','belongingKind']),
  warranty: Object.freeze(['itemType','recordId','belongingId','startsAt','endsAt']),
  service: Object.freeze(['itemType','recordId','targetItemId','targetType','serviceKind','occurredAt']),
  document: Object.freeze(['itemType','recordId','targetItemId','targetType','archiveItemId','documentKind'])
} satisfies Readonly<Record<ManagedHomeInventoryItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_INPUT_KEYS = Object.freeze({
  emergency_plan: Object.freeze(['itemType','planKind','title','evacuationInstructions']),
  meeting_point: Object.freeze([
    'itemType','planId','supersedesItemId','meetingPointKind','label','address','directions'
  ]),
  external_contact: Object.freeze([
    'itemType','planId','supersedesItemId','name','phoneE164','city','note'
  ]),
  checklist_item: Object.freeze(['itemType','planId','supersedesItemId','label','sortOrder']),
  checklist_status: Object.freeze(['itemType','planId','checklistItemId','status']),
  member_status: Object.freeze(['itemType','planId','memberPersonId','status','occurredAt','note'])
} satisfies Readonly<Record<FamilyEmergencyItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_REQUIRED_INPUT_KEYS = Object.freeze({
  emergency_plan: Object.freeze(['itemType','planKind','title','evacuationInstructions']),
  meeting_point: Object.freeze(['itemType','planId','meetingPointKind','label']),
  external_contact: Object.freeze(['itemType','planId','name','phoneE164','city']),
  checklist_item: Object.freeze(['itemType','planId','label','sortOrder']),
  checklist_status: Object.freeze(['itemType','planId','checklistItemId','status']),
  member_status: Object.freeze(['itemType','planId','memberPersonId','status','occurredAt'])
} satisfies Readonly<Record<FamilyEmergencyItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_PREPAREDNESS_INPUT_KEYS = Object.freeze({
  preparedness_kit: Object.freeze([
    'itemType','planId','supersedesItemId','kitKind','label'
  ]),
  preparedness_kit_item: Object.freeze([
    'itemType','planId','kitId','supersedesItemId','category','label',
    'targetQuantityMilliunits','quantityUnit','expiresOn'
  ]),
  preparedness_kit_check: Object.freeze([
    'itemType','planId','kitItemId','status','actualQuantityMilliunits','checkedAt','note'
  ]),
  emergency_drill: Object.freeze([
    'itemType','planId','supersedesItemId','drillKind','status','occurredAt','durationSeconds','note'
  ])
} satisfies Readonly<Record<FamilyEmergencyPreparednessItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_PREPAREDNESS_REQUIRED_INPUT_KEYS = Object.freeze({
  preparedness_kit: Object.freeze(['itemType','planId','kitKind','label']),
  preparedness_kit_item: Object.freeze([
    'itemType','planId','kitId','category','label','targetQuantityMilliunits','quantityUnit'
  ]),
  preparedness_kit_check: Object.freeze([
    'itemType','planId','kitItemId','status','actualQuantityMilliunits','checkedAt'
  ]),
  emergency_drill: Object.freeze(['itemType','planId','drillKind','status','occurredAt'])
} satisfies Readonly<Record<FamilyEmergencyPreparednessItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_ASSISTANCE_INPUT_KEYS = Object.freeze({
  emergency_profile: Object.freeze([
    'itemType','planId','label','subjectKind','subjectPersonId','subjectPetId','responsiblePersonId'
  ]),
  health_fact: Object.freeze([
    'itemType','profileId','supersedesItemId','factKind','bloodType','value','note'
  ]),
  emergency_contact: Object.freeze([
    'itemType','profileId','supersedesItemId','name','phoneE164','relationship','note'
  ]),
  assistance_instruction: Object.freeze([
    'itemType','profileId','supersedesItemId','instructionKind','instruction','note'
  ])
} satisfies Readonly<Record<FamilyEmergencyAssistanceItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_ASSISTANCE_REQUIRED_INPUT_KEYS = Object.freeze({
  emergency_profile: Object.freeze(['itemType','planId','label','subjectKind']),
  health_fact: Object.freeze(['itemType','profileId','factKind']),
  emergency_contact: Object.freeze(['itemType','profileId','name','phoneE164']),
  assistance_instruction: Object.freeze(['itemType','profileId','instructionKind','instruction'])
} satisfies Readonly<Record<FamilyEmergencyAssistanceItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_CARD_PORTABILITY_INPUT_KEYS = Object.freeze({
  card_configuration: Object.freeze(['itemType','profileId','label','locale']),
  selected_field: Object.freeze([
    'itemType','profileId','configurationId','sourceItemId','sourceItemType','fieldCode'
  ]),
  document_link: Object.freeze(['itemType','profileId','configurationId','archiveItemId']),
  export_event: Object.freeze([
    'itemType','profileId','configurationId','mode','selectedFieldCount','documentCount','selectionSha256','shareReceiptHash',
    'artifactSha256','artifactSizeBytes','powerSource','batteryLevel',
    'automaticLowBatteryDetection','lowBatteryClaimed','artifactReadbackStatus','printerDispatchStatus'
  ]),
  power_mode_event: Object.freeze([
    'itemType','profileId','configurationId','mode','activationSource','powerSource',
    'batteryLevel','automaticLowBatteryDetection','lowBatteryClaimed'
  ])
} satisfies Readonly<Record<FamilyEmergencyCardPortabilityItemType, readonly string[]>>);

export const FAMILY_EMERGENCY_CARD_PORTABILITY_REQUIRED_INPUT_KEYS = Object.freeze({
  card_configuration: Object.freeze(['itemType','profileId','label','locale']),
  selected_field: Object.freeze([
    'itemType','profileId','configurationId','sourceItemId','sourceItemType','fieldCode'
  ]),
  document_link: Object.freeze(['itemType','profileId','configurationId','archiveItemId']),
  export_event: Object.freeze([
    'itemType','profileId','configurationId','mode','selectedFieldCount','documentCount','selectionSha256','shareReceiptHash',
    'artifactSha256','artifactSizeBytes','powerSource','batteryLevel',
    'automaticLowBatteryDetection','lowBatteryClaimed','artifactReadbackStatus'
  ]),
  power_mode_event: Object.freeze([
    'itemType','profileId','configurationId','mode','activationSource','powerSource',
    'batteryLevel','automaticLowBatteryDetection','lowBatteryClaimed'
  ])
} satisfies Readonly<Record<FamilyEmergencyCardPortabilityItemType, readonly string[]>>);

export interface ManagedLifeDataContractInspection {
  readonly accepted:boolean;
  readonly itemType?:
    | 'profile'
    | 'activity'
    | ManagedHomeInventoryItemType
    | FamilyEmergencyItemType
    | FamilyEmergencyPreparednessItemType
    | FamilyEmergencyAssistanceItemType
    | FamilyEmergencyCardPortabilityItemType;
  readonly contractFamily?:
    | 'managed_life'
    | 'home_inventory'
    | 'family_emergency'
    | 'family_emergency_preparedness'
    | 'family_emergency_assistance'
    | 'family_emergency_card_portability';
  readonly exactShape:boolean;
  readonly unknownFields:readonly string[];
  readonly missingFields:readonly string[];
  readonly prohibitedFields:readonly string[];
  readonly panLikeValueDetected:boolean;
  readonly pathLikeValueDetected:boolean;
  readonly base64LikeValueDetected:boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizedKey = (key: string): string => key.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/gu, '');
const prohibitedKeyTokens = Object.freeze([
  'password','passphrase','passcode','secret','token','totp','credential','cvv','cvc','pin','pan',
  'cardnumber','internetbanking','filepath','outputpath','filename','storedname','originalname',
  'base64','binary','buffer','blob'
]);
const explicitlyAllowedOpaqueIdentifierKeys = new Set([
  'ownerpersonid','recordid','archiveitemid','financeassetid','financeexpenseid',
  'supersedesitemid','roomid','meterid','belongingid','targetitemid',
  'planid','checklistitemid','memberpersonid','kitid','kititemid','profileid',
  'subjectpersonid','subjectpetid','responsiblepersonid','configurationid','sourceitemid'
]);

const isExactOpaqueIdentifier = (value:string):boolean =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(value)
  || /^[a-z][a-z0-9]*(?:[-_:][a-z0-9]+)+$/iu.test(value);

const isProhibitedKey = (key: string): boolean => {
  const normalized = normalizedKey(key);
  if (explicitlyAllowedOpaqueIdentifierKeys.has(normalized)) return false;
  return prohibitedKeyTokens.some((token) => normalized === token || normalized.endsWith(token));
};

const isPathLike = (value: string): boolean =>
  /^[a-zA-Z]:[\\/]/u.test(value)
  || /^\\\\[^\\]+\\/u.test(value)
  || /^file:\/\//iu.test(value)
  || /^\/(?:home|users?|var|tmp|etc|opt|mnt|private)\//iu.test(value)
  || /(?:^|[\\/])\.\.(?:[\\/]|$)/u.test(value);

const isBase64Like = (value: string): boolean => {
  if (/^data:[^,]{1,160};base64,/iu.test(value)) return true;
  const compact = value.replace(/\s/gu, '');
  return compact.length >= 128
    && compact.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/u.test(compact);
};

const passesLuhn = (digits: string): boolean => {
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
};

export const containsLikelyManagedLifePan = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const candidates = value.match(/(?:\d[ -]?){13,19}/gu) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/gu, '');
    return digits.length >= 13
      && digits.length <= 19
      && !/^(\d)\1+$/u.test(digits)
      && passesLuhn(digits);
  });
};

interface RecursiveSignals {
  readonly prohibitedFields:string[];
  panLikeValueDetected:boolean;
  pathLikeValueDetected:boolean;
  base64LikeValueDetected:boolean;
  unsupportedContainerDetected:boolean;
}

const collectRecursiveSignals = (
  value: unknown,
  path: string,
  signals: RecursiveSignals,
  seen: Set<object>,
  fieldName?:string
): void => {
  if (typeof value === 'string') {
    const exactE164Phone = fieldName === 'phoneE164' && /^\+[1-9][0-9]{7,14}$/u.test(value);
    const exactOpaqueIdentifier = fieldName !== undefined
      && explicitlyAllowedOpaqueIdentifierKeys.has(normalizedKey(fieldName))
      && isExactOpaqueIdentifier(value);
    signals.panLikeValueDetected ||= !exactE164Phone
      && !exactOpaqueIdentifier
      && containsLikelyManagedLifePan(value);
    signals.pathLikeValueDetected ||= isPathLike(value);
    signals.base64LikeValueDetected ||= isBase64Like(value);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (!isPlainObject(value) || seen.has(value)) {
    signals.unsupportedContainerDetected = true;
    return;
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isProhibitedKey(key)) signals.prohibitedFields.push(childPath);
    collectRecursiveSignals(child, childPath, signals, seen, key);
  }
};

const compareKeys = (
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
  required: readonly string[],
  unknownFields: string[],
  missingFields: string[]
): void => {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) unknownFields.push(`${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) missingFields.push(`${path}.${key}`);
  }
};

export const inspectManagedLifeDataContract = (input: unknown): ManagedLifeDataContractInspection => {
  const signals: RecursiveSignals = {
    prohibitedFields: [],
    panLikeValueDetected: false,
    pathLikeValueDetected: false,
    base64LikeValueDetected: false,
    unsupportedContainerDetected: false
  };
  collectRecursiveSignals(input, '$', signals, new Set<object>());
  const unknownFields: string[] = [];
  const missingFields: string[] = [];
  let exactShape = isPlainObject(input);
  let itemType: ManagedLifeDataContractInspection['itemType'];
  let contractFamily: ManagedLifeDataContractInspection['contractFamily'];

  const homeInventoryDocument = isPlainObject(input)
    && input.itemType === 'document'
    && (Object.hasOwn(input, 'targetItemId')
      || Object.hasOwn(input, 'targetType')
      || Object.hasOwn(input, 'supersedesItemId'));
  const homeInventoryItem = isPlainObject(input)
    && typeof input.itemType === 'string'
    && Object.hasOwn(MANAGED_HOME_INVENTORY_INPUT_KEYS, input.itemType)
    && (input.itemType !== 'document' || homeInventoryDocument);

  const familyEmergencyItem = isPlainObject(input)
    && typeof input.itemType === 'string'
    && Object.hasOwn(FAMILY_EMERGENCY_INPUT_KEYS, input.itemType);

  const familyEmergencyPreparednessItem = isPlainObject(input)
    && typeof input.itemType === 'string'
    && Object.hasOwn(FAMILY_EMERGENCY_PREPAREDNESS_INPUT_KEYS, input.itemType);

  const familyEmergencyAssistanceItem = isPlainObject(input)
    && typeof input.itemType === 'string'
    && Object.hasOwn(FAMILY_EMERGENCY_ASSISTANCE_INPUT_KEYS, input.itemType);

  const familyEmergencyCardPortabilityItem = isPlainObject(input)
    && typeof input.itemType === 'string'
    && Object.hasOwn(FAMILY_EMERGENCY_CARD_PORTABILITY_INPUT_KEYS, input.itemType);

  if (familyEmergencyCardPortabilityItem) {
    const portabilityItemType = input.itemType as FamilyEmergencyCardPortabilityItemType;
    itemType = portabilityItemType;
    contractFamily = 'family_emergency_card_portability';
    let allowed = FAMILY_EMERGENCY_CARD_PORTABILITY_INPUT_KEYS[portabilityItemType];
    let required = FAMILY_EMERGENCY_CARD_PORTABILITY_REQUIRED_INPUT_KEYS[portabilityItemType];
    if (portabilityItemType === 'export_event') {
      if (input.mode === 'print') {
        required = Object.freeze([...required, 'printerDispatchStatus']);
      } else if (input.mode === 'pdf' || input.mode === 'encrypted_pack') {
        allowed = Object.freeze(allowed.filter((key) => key !== 'printerDispatchStatus'));
      } else {
        exactShape = false;
      }
    }
    compareKeys(input, '$', allowed, required, unknownFields, missingFields);
  } else if (familyEmergencyAssistanceItem) {
    const assistanceItemType = input.itemType as FamilyEmergencyAssistanceItemType;
    itemType = assistanceItemType;
    contractFamily = 'family_emergency_assistance';
    let allowed = FAMILY_EMERGENCY_ASSISTANCE_INPUT_KEYS[assistanceItemType];
    let required = FAMILY_EMERGENCY_ASSISTANCE_REQUIRED_INPUT_KEYS[assistanceItemType];
    if (assistanceItemType === 'emergency_profile') {
      if (input.subjectKind === 'person') {
        allowed = Object.freeze(['itemType','planId','label','subjectKind','subjectPersonId']);
        required = allowed;
      } else if (input.subjectKind === 'pet') {
        allowed = Object.freeze([
          'itemType','planId','label','subjectKind','subjectPetId','responsiblePersonId'
        ]);
        required = allowed;
      } else {
        exactShape = false;
      }
    } else if (assistanceItemType === 'health_fact') {
      if (input.factKind === 'blood_type') {
        allowed = Object.freeze([
          'itemType','profileId','supersedesItemId','factKind','bloodType','note'
        ]);
        required = Object.freeze(['itemType','profileId','factKind','bloodType']);
      } else {
        allowed = Object.freeze([
          'itemType','profileId','supersedesItemId','factKind','value','note'
        ]);
        required = Object.freeze(['itemType','profileId','factKind','value']);
      }
    }
    compareKeys(input, '$', allowed, required, unknownFields, missingFields);
  } else if (familyEmergencyPreparednessItem) {
    const preparednessItemType = input.itemType as FamilyEmergencyPreparednessItemType;
    itemType = preparednessItemType;
    contractFamily = 'family_emergency_preparedness';
    compareKeys(
      input,
      '$',
      FAMILY_EMERGENCY_PREPAREDNESS_INPUT_KEYS[preparednessItemType],
      FAMILY_EMERGENCY_PREPAREDNESS_REQUIRED_INPUT_KEYS[preparednessItemType],
      unknownFields,
      missingFields
    );
  } else if (familyEmergencyItem) {
    const emergencyItemType = input.itemType as FamilyEmergencyItemType;
    itemType = emergencyItemType;
    contractFamily = 'family_emergency';
    compareKeys(
      input,
      '$',
      FAMILY_EMERGENCY_INPUT_KEYS[emergencyItemType],
      FAMILY_EMERGENCY_REQUIRED_INPUT_KEYS[emergencyItemType],
      unknownFields,
      missingFields
    );
  } else if (homeInventoryItem) {
    const managedHomeItemType = input.itemType as ManagedHomeInventoryItemType;
    itemType = managedHomeItemType;
    contractFamily = 'home_inventory';
    compareKeys(
      input,
      '$',
      MANAGED_HOME_INVENTORY_INPUT_KEYS[managedHomeItemType],
      MANAGED_HOME_INVENTORY_REQUIRED_INPUT_KEYS[managedHomeItemType],
      unknownFields,
      missingFields
    );
  } else if (isPlainObject(input)
    && (input.itemType === 'profile' || input.itemType === 'activity' || input.itemType === 'document')) {
    itemType = input.itemType;
    contractFamily = 'managed_life';
    compareKeys(
      input,
      '$',
      MANAGED_LIFE_INPUT_KEYS[itemType],
      MANAGED_LIFE_REQUIRED_INPUT_KEYS[itemType],
      unknownFields,
      missingFields
    );
    if (itemType === 'profile') {
      const category = input.category;
      if (typeof category !== 'string' || !Object.hasOwn(MANAGED_LIFE_PROFILE_DETAIL_KEYS, category)) {
        exactShape = false;
      } else if (!isPlainObject(input.details)) {
        exactShape = false;
      } else {
        const managedCategory = category as ManagedLifeCategory;
        compareKeys(
          input.details,
          '$.details',
          MANAGED_LIFE_PROFILE_DETAIL_KEYS[managedCategory],
          MANAGED_LIFE_PROFILE_REQUIRED_DETAIL_KEYS[managedCategory],
          unknownFields,
          missingFields
        );
      }
      if (input.initialReminder !== undefined) {
        if (!isPlainObject(input.initialReminder)) exactShape = false;
        else compareKeys(
          input.initialReminder,
          '$.initialReminder',
          MANAGED_LIFE_INITIAL_REMINDER_KEYS,
          MANAGED_LIFE_INITIAL_REMINDER_KEYS,
          unknownFields,
          missingFields
        );
      }
    } else if (itemType === 'activity' && input.reminderMutation !== undefined) {
      if (!isPlainObject(input.reminderMutation)
        || (input.reminderMutation.action !== 'set' && input.reminderMutation.action !== 'clear')) {
        exactShape = false;
      } else {
        const action = input.reminderMutation.action;
        compareKeys(
          input.reminderMutation,
          '$.reminderMutation',
          MANAGED_LIFE_REMINDER_MUTATION_KEYS[action],
          MANAGED_LIFE_REMINDER_MUTATION_KEYS[action],
          unknownFields,
          missingFields
        );
      }
    }
  } else {
    exactShape = false;
  }

  exactShape = exactShape
    && !signals.unsupportedContainerDetected
    && unknownFields.length === 0
    && missingFields.length === 0;
  const accepted = exactShape
    && signals.prohibitedFields.length === 0
    && !signals.panLikeValueDetected
    && !signals.pathLikeValueDetected
    && !signals.base64LikeValueDetected;
  return Object.freeze({
    accepted,
    ...(itemType ? { itemType } : {}),
    ...(contractFamily ? { contractFamily } : {}),
    exactShape,
    unknownFields: Object.freeze(unknownFields.sort()),
    missingFields: Object.freeze(missingFields.sort()),
    prohibitedFields: Object.freeze(signals.prohibitedFields.sort()),
    panLikeValueDetected: signals.panLikeValueDetected,
    pathLikeValueDetected: signals.pathLikeValueDetected,
    base64LikeValueDetected: signals.base64LikeValueDetected
  });
};

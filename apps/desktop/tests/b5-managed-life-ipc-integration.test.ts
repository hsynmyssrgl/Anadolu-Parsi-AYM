import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const profileInputs = [
  { itemType:'profile', ownerPersonId:'person-1', category:'insurance', title:'DASK takibi', status:'active', privacy:'private', details:{ insuranceKind:'dask', provider:'Yerel sigorta kaydı' }, initialReminder:{ kind:'renewal', dueAt:'2027-01-01T09:00:00.000Z' } },
  { itemType:'profile', ownerPersonId:'person-1', category:'subscription', title:'İnternet aboneliği', status:'active', privacy:'family', details:{ provider:'Sağlayıcı', planName:'Aile planı', billingCycle:'monthly' } },
  { itemType:'profile', ownerPersonId:'person-1', category:'education', title:'Eğitim kaydı', status:'planned', privacy:'selected_members', details:{ institution:'Okul', program:'Program' } },
  { itemType:'profile', ownerPersonId:'person-1', category:'employment', title:'İş kaydı', status:'active', privacy:'private', details:{ employer:'İşveren', position:'Uzman' } },
  { itemType:'profile', ownerPersonId:'person-1', category:'official_operation', title:'Resmî başvuru', status:'planned', privacy:'private', details:{ authority:'Kurum', operationType:'Başvuru' } },
  { itemType:'profile', ownerPersonId:'person-1', category:'home', title:'Aile evi', status:'active', privacy:'family', details:{ tenure:'owner', propertyType:'residence', addressLabel:'Merkez konut' } },
  { itemType:'profile', ownerPersonId:'person-1', category:'vehicle', title:'Aile aracı', status:'active', privacy:'family', details:{ vehicleType:'car', energyType:'hybrid', plate:'06 ABC 123' } }
] as const;

const activityInput = {
  itemType:'activity', recordId:'vehicle-profile-1', activityKind:'fuel',
  occurredAt:'2026-08-11T10:00:00.000Z', provider:'Yerel kayıt', amountMinor:1_250,
  currency:'TRY', quantityMilliunits:25_500, odometerKm:42_000,
  reminderMutation:{ action:'set', kind:'maintenance', dueAt:'2026-10-11T10:00:00.000Z' },
  note:'Manuel yakıt geçmişi'
} as const;

const documentInput = {
  itemType:'document', recordId:'home-profile-1', archiveItemId:'archive-item-opaque-01',
  documentKind:'dask_policy', label:'DASK arşiv bağı'
} as const;

describe('33-E B5 managed life IPC integration boundary', () => {
  it('accepts only the zero-argument workspace read', () => {
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', [])).toEqual({ accepted:true });
    expect(evaluateIpcIntegrationPolicy('life:getManagedWorkspace', ['extra'])).toMatchObject({
      accepted:false, reason:'ARGUMENT_COUNT_MISMATCH'
    });
  });

  it('accepts all seven exact profile categories plus append-only activity and document inputs', () => {
    for (const input of [...profileInputs, activityInput, documentInput]) {
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [input])).toEqual({ accepted:true });
    }
  });

  it.each(['password','token','secret','cardNumber','pan','cvv','cvc','pin','filePath'])(
    'rejects recursive prohibited %s fields before dispatch',
    (field) => {
      const unsafe = { ...profileInputs[5], details:{ ...profileInputs[5].details, [field]:'unsafe' } };
      expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [unsafe])).toMatchObject({
        accepted:false,
        reason:'MANAGED_LIFE_SECRET_FIELD_PROHIBITED'
      });
    }
  );

  it('rejects PAN, path and base64-like values without exposing them to the handler', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...profileInputs[0], title:'Poliçe 4111 1111 1111 1111'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...documentInput, archiveItemId:'C:\\Users\\person\\policy.pdf'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_PATH_VALUE_PROHIBITED' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...activityInput, note:'A'.repeat(128)
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_SECRET_VALUE_PROHIBITED' });
  });

  it('rejects unknown and mismatched nested fields and invalid item discriminants', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...profileInputs[6], futureField:true
    }])).toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...profileInputs[5], details:{ ...profileInputs[5].details, rawDocumentContent:'unsafe' }
    }])).toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...profileInputs[5], details:{ vehicleType:'car', energyType:'fuel' }
    }])).toMatchObject({ accepted:false });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{ itemType:'registry_sync' }]))
      .toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ITEM_TYPE_INVALID' });
  });

  it('rejects non-canonical dates, unsafe integers and incomplete fuel or money pairs', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...activityInput, occurredAt:'2026-08-11'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...activityInput, amountMinor:Number.POSITIVE_INFINITY
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    const { quantityMilliunits: _quantity, ...fuelWithoutQuantity } = activityInput;
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [fuelWithoutQuantity]))
      .toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
    const { currency: _currency, ...amountWithoutCurrency } = activityInput;
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [amountWithoutCurrency]))
      .toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
  });

  it('rejects raw document fields and path-shaped opaque archive identifiers', () => {
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...documentInput, rawContent:'document bytes'
    }])).toMatchObject({ accepted:false, reason:'UNKNOWN_OBJECT_FIELD' });
    expect(evaluateIpcIntegrationPolicy('life:recordManagedItem', [{
      ...documentInput, archiveItemId:'folder/policy.pdf'
    }])).toMatchObject({ accepted:false, reason:'MANAGED_LIFE_ARGUMENT_INVALID' });
  });
});

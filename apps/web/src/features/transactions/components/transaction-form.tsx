'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateTransaction } from '../hooks';
import { transferTypeOptions } from './transfer-types';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/states';
import { Field, inputClass } from '@/shared/ui/field';

/** Mesmas regras do serviço, verificadas antes de sair do navegador. */
const schema = z.object({
  accountExternalIdDebit: z.uuid('Informe um UUID válido'),
  accountExternalIdCredit: z.uuid('Informe um UUID válido'),
  transferTypeId: z.coerce.number().int().positive('Escolha o tipo'),
  value: z.coerce
    .number({ error: 'Informe o valor' })
    .positive('O valor deve ser maior que zero')
    .multipleOf(0.01, 'Use no máximo duas casas decimais'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function TransactionForm() {
  const router = useRouter();
  const create = useCreateTransaction();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { transferTypeId: transferTypeOptions[0]?.id },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const created = await create.mutateAsync(values);
    router.push(`/transactions/${created.transactionExternalId}`);
  });

  return (
    <form
      aria-label="Nova transação"
      onSubmit={onSubmit}
      className="flex max-w-lg flex-col gap-4"
      noValidate
    >
      <Field
        id="accountExternalIdDebit"
        label="Conta de débito"
        error={errors.accountExternalIdDebit?.message}
      >
        <input
          id="accountExternalIdDebit"
          className={inputClass}
          placeholder="UUID da conta"
          {...form.register('accountExternalIdDebit')}
        />
      </Field>
      <Field
        id="accountExternalIdCredit"
        label="Conta de crédito"
        error={errors.accountExternalIdCredit?.message}
      >
        <input
          id="accountExternalIdCredit"
          className={inputClass}
          placeholder="UUID da conta"
          {...form.register('accountExternalIdCredit')}
        />
      </Field>
      <Field id="transferTypeId" label="Tipo" error={errors.transferTypeId?.message}>
        <select id="transferTypeId" className={inputClass} {...form.register('transferTypeId')}>
          {transferTypeOptions.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="value" label="Valor" error={errors.value?.message}>
        <input
          id="value"
          type="number"
          step="0.01"
          min="0"
          className={inputClass}
          {...form.register('value')}
        />
      </Field>
      {create.isError ? <ErrorState message={create.error.message} /> : null}
      <Button type="submit" disabled={isSubmitting || create.isPending}>
        {create.isPending ? 'Criando...' : 'Criar transação'}
      </Button>
    </form>
  );
}

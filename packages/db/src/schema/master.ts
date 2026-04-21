import { serial, varchar, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';

export const unitsOfMeasure = petshop.table('units_of_measure', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull(),
  isBase: boolean('is_base').default(false).notNull(),
});

export const categories = petshop.table('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
});

export const brands = petshop.table('brands', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
});

export const suppliers = petshop.table('suppliers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  contactPerson: varchar('contact_person', { length: 100 }),
  bankAccount: varchar('bank_account', { length: 100 }),
  address: text('address'),
  paymentTermDays: integer('payment_term_days').default(30),
});

export const customers = petshop.table('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const paymentMethods = petshop.table('payment_methods', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  type: varchar('type', { length: 20 }).notNull(), // CASH, BANK_TRANSFER, E-WALLET, QRIS, DEBT
});

export const expenseCategories = petshop.table('expense_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
});

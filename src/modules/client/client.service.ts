import { pool, withTransactionAs } from '../../config/db';
import { NotFoundError } from '../../utils/ApiError';
import { ClientRepository } from './client.repository';
import { CreateClientDto, UpdateClientDto } from './client.dto';

export class ClientService {
    constructor(private repo: ClientRepository) {}

    async getClients(filters: { search?: string, is_blacklisted?: boolean, equipment_category?: string }) {
        return this.repo.findAll(pool, filters);
    }

    async getClientById(id: number) {
        const client = await this.repo.findById(id, pool);
        if (!client) throw new NotFoundError('Cliente não encontrado.');
        return client;
    }

    async createClient(data: CreateClientDto, userId: string) {
        return withTransactionAs(userId, (db) => this.repo.create(data, db));
    }

    async updateClient(id: number, data: UpdateClientDto, userId: string) {
        return withTransactionAs(userId, async (db) => {
            const { propagateToReports, ...clientData } = data;
            const updated = await this.repo.update(id, clientData, db);
            if (!updated) throw new NotFoundError('Cliente não encontrado.');

            let updatedReportsCount = 0;
            let updatedSchedulesCount = 0;
            if (propagateToReports) {
                const params = [
                    updated.name || null,
                    updated.address || null,
                    updated.nif || null,
                    updated.city || null,
                    updated.postCode || null,
                    userId,
                    id
                ];

                const repRes = await db.query(
                    `UPDATE reports SET
                        client_name = COALESCE($1, client_name),
                        client_address = COALESCE($2, client_address),
                        client_nif = COALESCE($3, client_nif),
                        client_city = COALESCE($4, client_city),
                        client_postcode = COALESCE($5, client_postcode),
                        updated_by = $6
                    WHERE "clientId" = $7 AND deleted_at IS NULL`,
                    params
                );
                updatedReportsCount = repRes.rowCount || 0;

                const schRes = await db.query(
                    `UPDATE schedules SET
                        client_name = COALESCE($1, client_name),
                        client_address = COALESCE($2, client_address),
                        client_nif = COALESCE($3, client_nif),
                        client_city = COALESCE($4, client_city),
                        client_postcode = COALESCE($5, client_postcode),
                        updated_by = $6
                    WHERE "clientId" = $7`,
                    params
                );
                updatedSchedulesCount = schRes.rowCount || 0;
            }

            return { ...updated, updatedReportsCount, updatedSchedulesCount };
        });
    }

    async deleteClient(id: number, userId: string) {
        return withTransactionAs(userId, async (db) => {
            const deleted = await this.repo.delete(id, db);
            if (!deleted) throw new NotFoundError('Cliente não encontrado.');
        });
    }

    async getClientUsers(clientId: number) {
        return this.repo.findUsersByClientId(clientId, pool);
    }
}

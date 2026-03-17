'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { guestsService } from '@/services/guests.service';
import type { Guest } from '@/lib/types';

interface GuestSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (guest: Guest) => void;
  onCreateNew: () => void;
}

export function GuestSearchModal({ open, onClose, onSelect, onCreateNew }: GuestSearchModalProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['guests', 'search', search],
    queryFn: () => guestsService.list({ search, limit: 10 }),
    enabled: open && search.length >= 2,
  });

  return (
    <Modal open={open} onClose={onClose} title="Buscar Hóspede">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="Buscar por nome, CPF ou e-mail..."
          />
        </div>

        {search.length < 2 && (
          <p className="text-center text-sm text-gray-400 py-4">Digite ao menos 2 caracteres para buscar.</p>
        )}

        {isLoading && (
          <p className="text-center text-sm text-gray-400 py-4">Buscando...</p>
        )}

        {data && data.data.length === 0 && search.length >= 2 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Nenhum hóspede encontrado.</p>
          </div>
        )}

        {data && data.data.length > 0 && (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden max-h-64 overflow-y-auto">
            {data.data.map((guest) => (
              <button
                key={guest.id}
                onClick={() => onSelect(guest)}
                className="flex w-full items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{guest.fullName}</p>
                  <p className="text-xs text-gray-500">{guest.cpfPassport}{guest.phone ? ` · ${guest.phone}` : ''}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          <Button variant="secondary" className="w-full" onClick={onCreateNew}>
            <UserPlus className="h-4 w-4" />
            Cadastrar novo hóspede
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acessorio_versoes: {
        Row: {
          acessorio_id: string
          created_at: string | null
          id: string
          versao_id: string
        }
        Insert: {
          acessorio_id: string
          created_at?: string | null
          id?: string
          versao_id: string
        }
        Update: {
          acessorio_id?: string
          created_at?: string | null
          id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acessorio_versoes_acessorio_id_fkey"
            columns: ["acessorio_id"]
            isOneToOne: false
            referencedRelation: "acessorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acessorio_versoes_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      acessorios: {
        Row: {
          atualizado_por: string | null
          created_at: string | null
          data_ultimo_reajuste: string | null
          especificacoes_tecnicas: string | null
          fator_nac: number | null
          id: string
          moeda: string | null
          nome: string
          status: string | null
          tipo: string | null
          updated_at: string | null
          valor: number | null
          valor_anterior: number | null
          versoes: Json | null
        }
        Insert: {
          atualizado_por?: string | null
          created_at?: string | null
          data_ultimo_reajuste?: string | null
          especificacoes_tecnicas?: string | null
          fator_nac?: number | null
          id?: string
          moeda?: string | null
          nome: string
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number | null
          valor_anterior?: number | null
          versoes?: Json | null
        }
        Update: {
          atualizado_por?: string | null
          created_at?: string | null
          data_ultimo_reajuste?: string | null
          especificacoes_tecnicas?: string | null
          fator_nac?: number | null
          id?: string
          moeda?: string | null
          nome?: string
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          valor?: number | null
          valor_anterior?: number | null
          versoes?: Json | null
        }
        Relationships: []
      }
      area_atuacao: {
        Row: {
          cor: string | null
          created_at: string
          geometria: Json | null
          id: string
          representante: string | null
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          geometria?: Json | null
          id?: string
          representante?: string | null
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          geometria?: Json | null
          id?: string
          representante?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_atuacao_representante_fkey"
            columns: ["representante"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          data_changes: Json | null
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          data_changes?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          data_changes?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          logo: string | null
          nome: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          logo?: string | null
          nome: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          logo?: string | null
          nome?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chatbot_admin_audit: {
        Row: {
          admin_email: string
          admin_id: string
          conversa_id: string | null
          created_at: string
          id: string
          motivo: string | null
          target_user_email: string | null
          target_user_id: string
        }
        Insert: {
          admin_email: string
          admin_id: string
          conversa_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          target_user_email?: string | null
          target_user_id: string
        }
        Update: {
          admin_email?: string
          admin_id?: string
          conversa_id?: string | null
          created_at?: string
          id?: string
          motivo?: string | null
          target_user_email?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_admin_audit_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_conversas: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chatbot_mensagens: {
        Row: {
          attachment: Json | null
          content: string
          conversa_id: string
          created_at: string
          feedback: string | null
          id: string
          is_error: boolean
          role: string
          table_data: Json | null
          user_id: string
        }
        Insert: {
          attachment?: Json | null
          content: string
          conversa_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_error?: boolean
          role: string
          table_data?: Json | null
          user_id: string
        }
        Update: {
          attachment?: Json | null
          content?: string
          conversa_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          is_error?: boolean
          role?: string
          table_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "chatbot_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_contatos: {
        Row: {
          cargo: string | null
          cliente_id: string
          created_at: string
          email: string | null
          id: string
          is_principal: boolean
          nome: string
          telefone: string | null
        }
        Insert: {
          cargo?: string | null
          cliente_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_principal?: boolean
          nome: string
          telefone?: string | null
        }
        Update: {
          cargo?: string | null
          cliente_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_principal?: boolean
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          complementos: string | null
          contato: string | null
          contatos_adicionais: Json | null
          created_at: string | null
          criado_por: string | null
          documento: string | null
          dt_cad: string | null
          email: string | null
          email_fiscal: string | null
          estado: string | null
          fantasia: string
          id: string
          limite_credito: number | null
          logradouro: string | null
          maquina_interesse: string | null
          maquina_interesse_adicionada_em: string | null
          maquina_interesse_adicionada_por: string | null
          numero: string | null
          razao_social: string | null
          status: string
          telefone: string | null
          telefone_2: string | null
          telefone_3: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complementos?: string | null
          contato?: string | null
          contatos_adicionais?: Json | null
          created_at?: string | null
          criado_por?: string | null
          documento?: string | null
          dt_cad?: string | null
          email?: string | null
          email_fiscal?: string | null
          estado?: string | null
          fantasia: string
          id?: string
          limite_credito?: number | null
          logradouro?: string | null
          maquina_interesse?: string | null
          maquina_interesse_adicionada_em?: string | null
          maquina_interesse_adicionada_por?: string | null
          numero?: string | null
          razao_social?: string | null
          status?: string
          telefone?: string | null
          telefone_2?: string | null
          telefone_3?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          complementos?: string | null
          contato?: string | null
          contatos_adicionais?: Json | null
          created_at?: string | null
          criado_por?: string | null
          documento?: string | null
          dt_cad?: string | null
          email?: string | null
          email_fiscal?: string | null
          estado?: string | null
          fantasia?: string
          id?: string
          limite_credito?: number | null
          logradouro?: string | null
          maquina_interesse?: string | null
          maquina_interesse_adicionada_em?: string | null
          maquina_interesse_adicionada_por?: string | null
          numero?: string | null
          razao_social?: string | null
          status?: string
          telefone?: string | null
          telefone_2?: string | null
          telefone_3?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes_antigos: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contato: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes_base_antiga: {
        Row: {
          bairro: string | null
          cep: string | null
          cep_receita: string | null
          cidade: string | null
          cnae_descricao: string | null
          cnae_principal: string | null
          cnaes_secundarios: Json | null
          cnpj: string | null
          complemento: string | null
          contato: string | null
          created_at: string
          data_abertura: string | null
          email: string | null
          email_receita: string | null
          endereco: string | null
          id: string
          logradouro: string | null
          municipio: string | null
          natureza_juridica: string | null
          nome: string | null
          nome_fantasia_receita: string | null
          numero: string | null
          porte: string | null
          qsa: Json | null
          razao_social_receita: string | null
          receita_consultado_em: string | null
          receita_provedor: string | null
          receita_status: string
          situacao_cadastral: string | null
          telefone: string | null
          telefone_receita: string | null
          uf: string | null
          uf_receita: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cep_receita?: string | null
          cidade?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnaes_secundarios?: Json | null
          cnpj?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string
          data_abertura?: string | null
          email?: string | null
          email_receita?: string | null
          endereco?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          natureza_juridica?: string | null
          nome?: string | null
          nome_fantasia_receita?: string | null
          numero?: string | null
          porte?: string | null
          qsa?: Json | null
          razao_social_receita?: string | null
          receita_consultado_em?: string | null
          receita_provedor?: string | null
          receita_status?: string
          situacao_cadastral?: string | null
          telefone?: string | null
          telefone_receita?: string | null
          uf?: string | null
          uf_receita?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cep_receita?: string | null
          cidade?: string | null
          cnae_descricao?: string | null
          cnae_principal?: string | null
          cnaes_secundarios?: Json | null
          cnpj?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string
          data_abertura?: string | null
          email?: string | null
          email_receita?: string | null
          endereco?: string | null
          id?: string
          logradouro?: string | null
          municipio?: string | null
          natureza_juridica?: string | null
          nome?: string | null
          nome_fantasia_receita?: string | null
          numero?: string | null
          porte?: string | null
          qsa?: Json | null
          razao_social_receita?: string | null
          receita_consultado_em?: string | null
          receita_provedor?: string | null
          receita_status?: string
          situacao_cadastral?: string | null
          telefone?: string | null
          telefone_receita?: string | null
          uf?: string | null
          uf_receita?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes_base_antiga_contatos: {
        Row: {
          cliente_base_antiga_id: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cliente_base_antiga_id?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cliente_base_antiga_id?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_base_antiga_contatos_cliente_base_antiga_id_fkey"
            columns: ["cliente_base_antiga_id"]
            isOneToOne: false
            referencedRelation: "clientes_base_antiga"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      eventos: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          local: string | null
          status: string | null
          titulo: string
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          local?: string | null
          status?: string | null
          titulo: string
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          local?: string | null
          status?: string | null
          titulo?: string
        }
        Relationships: []
      }
      gerentes: {
        Row: {
          cargo: string | null
          categoria_restrita_id: string | null
          celular: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          profile_id: string | null
          rd_station_id: string | null
          status: string
          updated_at: string | null
          usuario: string | null
        }
        Insert: {
          cargo?: string | null
          categoria_restrita_id?: string | null
          celular?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          profile_id?: string | null
          rd_station_id?: string | null
          status?: string
          updated_at?: string | null
          usuario?: string | null
        }
        Update: {
          cargo?: string | null
          categoria_restrita_id?: string | null
          celular?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          profile_id?: string | null
          rd_station_id?: string | null
          status?: string
          updated_at?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gerentes_categoria_restrita_id_fkey"
            columns: ["categoria_restrita_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gerentes_categoria_restrita_id_fkey"
            columns: ["categoria_restrita_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gerentes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_importacoes: {
        Row: {
          arquivo: string | null
          created_at: string
          erros: Json | null
          id: string
          registros_erro: number | null
          registros_importados: number | null
          status: string | null
          tipo: string | null
          usuario: string | null
        }
        Insert: {
          arquivo?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          registros_erro?: number | null
          registros_importados?: number | null
          status?: string | null
          tipo?: string | null
          usuario?: string | null
        }
        Update: {
          arquivo?: string | null
          created_at?: string
          erros?: Json | null
          id?: string
          registros_erro?: number | null
          registros_importados?: number | null
          status?: string | null
          tipo?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      marcas: {
        Row: {
          cod: number | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          nome: string
          pais: string | null
          reg: number | null
          site: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          cod?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nome: string
          pais?: string | null
          reg?: number | null
          site?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          cod?: number | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nome?: string
          pais?: string | null
          reg?: number | null
          site?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      modelo_imagens: {
        Row: {
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          modelo_id: string
          nome_arquivo: string | null
          tamanho_bytes: number | null
          tipo_documento: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          modelo_id: string
          nome_arquivo?: string | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          modelo_id?: string
          nome_arquivo?: string | null
          tamanho_bytes?: number | null
          tipo_documento?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_imagens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos: {
        Row: {
          categoria_nome: string | null
          cod: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          marca: string | null
          nome: string
          produto: string | null
          reg: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          categoria_nome?: string | null
          cod?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          marca?: string | null
          nome: string
          produto?: string | null
          reg?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          categoria_nome?: string | null
          cod?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          marca?: string | null
          nome?: string
          produto?: string | null
          reg?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modelos_marca_fkey"
            columns: ["marca"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_produto_fkey"
            columns: ["produto"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string | null
          tipo: string | null
          titulo: string
          usuario: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: string | null
          titulo: string
          usuario?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: string | null
          titulo?: string
          usuario?: string | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      preferencias: {
        Row: {
          chave: string
          id: string
          usuario: string | null
          valor: Json | null
        }
        Insert: {
          chave: string
          id?: string
          usuario?: string | null
          valor?: Json | null
        }
        Update: {
          chave?: string
          id?: string
          usuario?: string | null
          valor?: Json | null
        }
        Relationships: []
      }
      produtos: {
        Row: {
          acessorios_standards: string | null
          categoria: string | null
          categoria_nome: string | null
          cod: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          especificacoes: Json | null
          fabricante: string | null
          fotos: Json | null
          id: string
          modelo: string | null
          nome: string
          reg: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          acessorios_standards?: string | null
          categoria?: string | null
          categoria_nome?: string | null
          cod?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          especificacoes?: Json | null
          fabricante?: string | null
          fotos?: Json | null
          id?: string
          modelo?: string | null
          nome: string
          reg?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          acessorios_standards?: string | null
          categoria?: string | null
          categoria_nome?: string | null
          cod?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          especificacoes?: Json | null
          fabricante?: string | null
          fotos?: Json | null
          id?: string
          modelo?: string | null
          nome?: string
          reg?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_fkey"
            columns: ["categoria"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_categoria_fkey"
            columns: ["categoria"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assinatura: string | null
          avatar_url: string | null
          celular: string | null
          created_at: string
          documento: string | null
          email: string
          estado_atuacao: string | null
          gerente_id: string | null
          id: string
          last_seen_at: string | null
          menu_access: Json | null
          name: string
          role: string
          setor: string | null
          status: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          assinatura?: string | null
          avatar_url?: string | null
          celular?: string | null
          created_at?: string
          documento?: string | null
          email: string
          estado_atuacao?: string | null
          gerente_id?: string | null
          id: string
          last_seen_at?: string | null
          menu_access?: Json | null
          name: string
          role?: string
          setor?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          assinatura?: string | null
          avatar_url?: string | null
          celular?: string | null
          created_at?: string
          documento?: string | null
          email?: string
          estado_atuacao?: string | null
          gerente_id?: string | null
          id?: string
          last_seen_at?: string | null
          menu_access?: Json | null
          name?: string
          role?: string
          setor?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_membros: {
        Row: {
          created_at: string
          id: string
          papel: string
          projeto_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          papel?: string
          projeto_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          papel?: string
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_membros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          cliente: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          ooo: string | null
          status: string
          updated_at: string | null
          user: string | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ooo?: string | null
          status?: string
          updated_at?: string | null
          user?: string | null
        }
        Update: {
          cliente?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ooo?: string | null
          status?: string
          updated_at?: string | null
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_fkey"
            columns: ["cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_email_envios: {
        Row: {
          assunto: string | null
          criado_em: string | null
          destinatarios: string | null
          http_status: number | null
          id: string
          ok: boolean | null
          proposta_id: string | null
          resposta: string | null
          webhook_url: string | null
        }
        Insert: {
          assunto?: string | null
          criado_em?: string | null
          destinatarios?: string | null
          http_status?: number | null
          id?: string
          ok?: boolean | null
          proposta_id?: string | null
          resposta?: string | null
          webhook_url?: string | null
        }
        Update: {
          assunto?: string | null
          criado_em?: string | null
          destinatarios?: string | null
          http_status?: number | null
          id?: string
          ok?: boolean | null
          proposta_id?: string | null
          resposta?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_email_envios_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versoes: {
        Row: {
          created_at: string
          desconto_percentual: number | null
          desconto_valor: number | null
          id: string
          ordem: number
          proposta_id: string
          quantidade: number
          tipo_proposta: string | null
          updated_at: string
          valor_unitario: number
          versao_id: string
        }
        Insert: {
          created_at?: string
          desconto_percentual?: number | null
          desconto_valor?: number | null
          id?: string
          ordem?: number
          proposta_id: string
          quantidade?: number
          tipo_proposta?: string | null
          updated_at?: string
          valor_unitario?: number
          versao_id: string
        }
        Update: {
          created_at?: string
          desconto_percentual?: number | null
          desconto_valor?: number | null
          id?: string
          ordem?: number
          proposta_id?: string
          quantidade?: number
          tipo_proposta?: string | null
          updated_at?: string
          valor_unitario?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versoes_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          acessorios_proposta: Json | null
          assinado_por_gerente: string | null
          assinado_por_representante: string | null
          assinante_gerente_id: string | null
          assinante_representante_id: string | null
          assinatura_assessor_tecnico: string | null
          assinatura_cliente: string | null
          assinatura_gerente_produto: string | null
          assinatura_representante: string | null
          assistencia_tecnica_detalhada: string | null
          cambio_estimado: number | null
          cambio_estimado_base: string | null
          cambio_estimado_data: string | null
          campos_adicionais: Json | null
          certificacoes: string | null
          certificacoes_seguranca: string | null
          cliente: string | null
          cliente_original: string | null
          cobertura_garantia: string | null
          condicoes_pagamento: string | null
          contato: string | null
          contato_id: string | null
          cotacao_moeda: number | null
          created_at: string | null
          criterios_aceitacao: string | null
          dados_snapshot: Json | null
          data_alteracao_status: string | null
          data_assinatura_gerente: string | null
          data_assinatura_representante: string | null
          data_cotacao_moeda: string | null
          descricao_proposta: string | null
          dt_cad: string | null
          emails_notificacao: string | null
          especificacoes_tecnicas: string | null
          estado_faturamento: string | null
          frase_comissao: string | null
          frase_preco: string | null
          garantia_acessorios: string | null
          gerente: string | null
          gerente_original: string | null
          id: string
          imposto_icms: number | null
          imposto_ipi: number | null
          is_pacote: boolean
          itens_snapshot: Json | null
          link_publico_RD: string | null
          materiais_utilizados: string | null
          modelo_licitacao: boolean
          moeda: string | null
          moeda_original: string | null
          nome_assessor_tecnico: string | null
          nome_gerente_produto: string | null
          nome_representante_comercial: string | null
          normas_aplicaveis: string | null
          normas_seguranca: string | null
          nota_rep: number | null
          numero_proposta: string | null
          pdf_anexo: string | null
          percentual_desconto: number | null
          prazo_entrega: string | null
          preco_especial: number | null
          projeto: string | null
          public_token: string | null
          regime_preco: string | null
          representante: string | null
          representante_original: string | null
          revisao: string | null
          secoes_adicionais: Json | null
          status: string
          telefone: string | null
          tipo_proposta: string | null
          tipo_proposta_override: Json | null
          transporte_seguro: string | null
          treinamento_tecnico: string | null
          ultimo_usuario_status: string | null
          updated_at: string | null
          user: string | null
          validade_oferta: string | null
          valor_atual: number | null
          valor_final: number | null
          valor_sem_desconto: number | null
          versao: string | null
          versao_original: string | null
          versoes_comparacao: Json | null
        }
        Insert: {
          acessorios_proposta?: Json | null
          assinado_por_gerente?: string | null
          assinado_por_representante?: string | null
          assinante_gerente_id?: string | null
          assinante_representante_id?: string | null
          assinatura_assessor_tecnico?: string | null
          assinatura_cliente?: string | null
          assinatura_gerente_produto?: string | null
          assinatura_representante?: string | null
          assistencia_tecnica_detalhada?: string | null
          cambio_estimado?: number | null
          cambio_estimado_base?: string | null
          cambio_estimado_data?: string | null
          campos_adicionais?: Json | null
          certificacoes?: string | null
          certificacoes_seguranca?: string | null
          cliente?: string | null
          cliente_original?: string | null
          cobertura_garantia?: string | null
          condicoes_pagamento?: string | null
          contato?: string | null
          contato_id?: string | null
          cotacao_moeda?: number | null
          created_at?: string | null
          criterios_aceitacao?: string | null
          dados_snapshot?: Json | null
          data_alteracao_status?: string | null
          data_assinatura_gerente?: string | null
          data_assinatura_representante?: string | null
          data_cotacao_moeda?: string | null
          descricao_proposta?: string | null
          dt_cad?: string | null
          emails_notificacao?: string | null
          especificacoes_tecnicas?: string | null
          estado_faturamento?: string | null
          frase_comissao?: string | null
          frase_preco?: string | null
          garantia_acessorios?: string | null
          gerente?: string | null
          gerente_original?: string | null
          id?: string
          imposto_icms?: number | null
          imposto_ipi?: number | null
          is_pacote?: boolean
          itens_snapshot?: Json | null
          link_publico_RD?: string | null
          materiais_utilizados?: string | null
          modelo_licitacao?: boolean
          moeda?: string | null
          moeda_original?: string | null
          nome_assessor_tecnico?: string | null
          nome_gerente_produto?: string | null
          nome_representante_comercial?: string | null
          normas_aplicaveis?: string | null
          normas_seguranca?: string | null
          nota_rep?: number | null
          numero_proposta?: string | null
          pdf_anexo?: string | null
          percentual_desconto?: number | null
          prazo_entrega?: string | null
          preco_especial?: number | null
          projeto?: string | null
          public_token?: string | null
          regime_preco?: string | null
          representante?: string | null
          representante_original?: string | null
          revisao?: string | null
          secoes_adicionais?: Json | null
          status?: string
          telefone?: string | null
          tipo_proposta?: string | null
          tipo_proposta_override?: Json | null
          transporte_seguro?: string | null
          treinamento_tecnico?: string | null
          ultimo_usuario_status?: string | null
          updated_at?: string | null
          user?: string | null
          validade_oferta?: string | null
          valor_atual?: number | null
          valor_final?: number | null
          valor_sem_desconto?: number | null
          versao?: string | null
          versao_original?: string | null
          versoes_comparacao?: Json | null
        }
        Update: {
          acessorios_proposta?: Json | null
          assinado_por_gerente?: string | null
          assinado_por_representante?: string | null
          assinante_gerente_id?: string | null
          assinante_representante_id?: string | null
          assinatura_assessor_tecnico?: string | null
          assinatura_cliente?: string | null
          assinatura_gerente_produto?: string | null
          assinatura_representante?: string | null
          assistencia_tecnica_detalhada?: string | null
          cambio_estimado?: number | null
          cambio_estimado_base?: string | null
          cambio_estimado_data?: string | null
          campos_adicionais?: Json | null
          certificacoes?: string | null
          certificacoes_seguranca?: string | null
          cliente?: string | null
          cliente_original?: string | null
          cobertura_garantia?: string | null
          condicoes_pagamento?: string | null
          contato?: string | null
          contato_id?: string | null
          cotacao_moeda?: number | null
          created_at?: string | null
          criterios_aceitacao?: string | null
          dados_snapshot?: Json | null
          data_alteracao_status?: string | null
          data_assinatura_gerente?: string | null
          data_assinatura_representante?: string | null
          data_cotacao_moeda?: string | null
          descricao_proposta?: string | null
          dt_cad?: string | null
          emails_notificacao?: string | null
          especificacoes_tecnicas?: string | null
          estado_faturamento?: string | null
          frase_comissao?: string | null
          frase_preco?: string | null
          garantia_acessorios?: string | null
          gerente?: string | null
          gerente_original?: string | null
          id?: string
          imposto_icms?: number | null
          imposto_ipi?: number | null
          is_pacote?: boolean
          itens_snapshot?: Json | null
          link_publico_RD?: string | null
          materiais_utilizados?: string | null
          modelo_licitacao?: boolean
          moeda?: string | null
          moeda_original?: string | null
          nome_assessor_tecnico?: string | null
          nome_gerente_produto?: string | null
          nome_representante_comercial?: string | null
          normas_aplicaveis?: string | null
          normas_seguranca?: string | null
          nota_rep?: number | null
          numero_proposta?: string | null
          pdf_anexo?: string | null
          percentual_desconto?: number | null
          prazo_entrega?: string | null
          preco_especial?: number | null
          projeto?: string | null
          public_token?: string | null
          regime_preco?: string | null
          representante?: string | null
          representante_original?: string | null
          revisao?: string | null
          secoes_adicionais?: Json | null
          status?: string
          telefone?: string | null
          tipo_proposta?: string | null
          tipo_proposta_override?: Json | null
          transporte_seguro?: string | null
          treinamento_tecnico?: string | null
          ultimo_usuario_status?: string | null
          updated_at?: string | null
          user?: string | null
          validade_oferta?: string | null
          valor_atual?: number | null
          valor_final?: number | null
          valor_sem_desconto?: number | null
          versao?: string | null
          versao_original?: string | null
          versoes_comparacao?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_assinante_gerente_fkey"
            columns: ["assinante_gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_assinante_representante_fkey"
            columns: ["assinante_representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_cliente_fkey"
            columns: ["cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "cliente_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_gerente_fkey"
            columns: ["gerente"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_projeto_fkey"
            columns: ["projeto"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_representante_fkey"
            columns: ["representante"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_versao_fkey"
            columns: ["versao"]
            isOneToOne: false
            referencedRelation: "versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      regioes: {
        Row: {
          cidades: Json
          created_at: string | null
          id: string
          nome: string
          status: string
          todo_o_estado: boolean
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          cidades?: Json
          created_at?: string | null
          id?: string
          nome: string
          status?: string
          todo_o_estado?: boolean
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          cidades?: Json
          created_at?: string | null
          id?: string
          nome?: string
          status?: string
          todo_o_estado?: boolean
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registro_alteracoes: {
        Row: {
          acao: string
          campos_alterados: Json | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          detalhes: string | null
          entidade: string
          id: string
          registro_id: string
          registro_nome: string | null
          revertido_de_id: string | null
          usuario_email: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: Json | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          detalhes?: string | null
          entidade: string
          id?: string
          registro_id: string
          registro_nome?: string | null
          revertido_de_id?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: Json | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          detalhes?: string | null
          entidade?: string
          id?: string
          registro_id?: string
          registro_nome?: string | null
          revertido_de_id?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_alteracoes_revertido_de_id_fkey"
            columns: ["revertido_de_id"]
            isOneToOne: false
            referencedRelation: "registro_alteracoes"
            referencedColumns: ["id"]
          },
        ]
      }
      representante_anotacoes: {
        Row: {
          ano_referencia: number
          autor_id: string | null
          autor_nome: string | null
          created_at: string
          id: string
          representante_id: string
          texto: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ano_referencia?: number
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          representante_id: string
          texto: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ano_referencia?: number
          autor_id?: string | null
          autor_nome?: string | null
          created_at?: string
          id?: string
          representante_id?: string
          texto?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representante_anotacoes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      representante_categorias: {
        Row: {
          categoria_id: string
          created_at: string | null
          id: string
          representante_id: string
        }
        Insert: {
          categoria_id: string
          created_at?: string | null
          id?: string
          representante_id: string
        }
        Update: {
          categoria_id?: string
          created_at?: string | null
          id?: string
          representante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representante_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representante_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representante_categorias_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      representante_gerente_categorias: {
        Row: {
          categoria_id: string
          created_at: string | null
          gerente_id: string
          id: string
          representante_id: string
          updated_at: string | null
        }
        Insert: {
          categoria_id: string
          created_at?: string | null
          gerente_id: string
          id?: string
          representante_id: string
          updated_at?: string | null
        }
        Update: {
          categoria_id?: string
          created_at?: string | null
          gerente_id?: string
          id?: string
          representante_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "representante_gerente_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representante_gerente_categorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representante_gerente_categorias_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representante_gerente_categorias_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      representante_regioes: {
        Row: {
          created_at: string | null
          id: string
          regiao_id: string
          representante_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          regiao_id: string
          representante_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          regiao_id?: string
          representante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representante_regioes_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representante_regioes_representante_id_fkey"
            columns: ["representante_id"]
            isOneToOne: false
            referencedRelation: "representantes"
            referencedColumns: ["id"]
          },
        ]
      }
      representantes: {
        Row: {
          bairro: string | null
          celular: string | null
          cep: string | null
          cidade: string | null
          cod: string | null
          complementos: string | null
          created_at: string | null
          documento: string | null
          email: string | null
          emails: Json | null
          endereco: string | null
          estado: string | null
          fantasia: string
          gerente_id: string | null
          id: string
          logradouro: string | null
          numero: string | null
          profile_id: string | null
          razao_social: string | null
          rd_station_id: string | null
          reg: number | null
          regiao: string | null
          sigla: string | null
          status: string
          telefone: string | null
          telefone_principal: string | null
          telefones: Json | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cod?: string | null
          complementos?: string | null
          created_at?: string | null
          documento?: string | null
          email?: string | null
          emails?: Json | null
          endereco?: string | null
          estado?: string | null
          fantasia: string
          gerente_id?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          profile_id?: string | null
          razao_social?: string | null
          rd_station_id?: string | null
          reg?: number | null
          regiao?: string | null
          sigla?: string | null
          status?: string
          telefone?: string | null
          telefone_principal?: string | null
          telefones?: Json | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          celular?: string | null
          cep?: string | null
          cidade?: string | null
          cod?: string | null
          complementos?: string | null
          created_at?: string | null
          documento?: string | null
          email?: string | null
          emails?: Json | null
          endereco?: string | null
          estado?: string | null
          fantasia?: string
          gerente_id?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          profile_id?: string | null
          razao_social?: string | null
          rd_station_id?: string | null
          reg?: number | null
          regiao?: string | null
          sigla?: string | null
          status?: string
          telefone?: string | null
          telefone_principal?: string | null
          telefones?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "representantes_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representantes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          menu_access: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          menu_access?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          menu_access?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tipos_proposta: {
        Row: {
          aplicar_fator_nac: boolean
          assistencia_tecnica: string | null
          atualizado_por: string | null
          campos_adicionais: Json
          comissao: number | null
          condicoes_pagamento: string | null
          created_at: string | null
          fator_nacionalizacao: string | null
          frase_comissao: string | null
          frase_preco: string | null
          garantia: string | null
          id: string
          imposto_icms: string | null
          imposto_ipi: string | null
          nome: string
          prazo_entrega: string | null
          status: string
          transporte_seguro: string | null
          treinamento_tecnico: string | null
          updated_at: string | null
          validade_oferta: string | null
        }
        Insert: {
          aplicar_fator_nac?: boolean
          assistencia_tecnica?: string | null
          atualizado_por?: string | null
          campos_adicionais?: Json
          comissao?: number | null
          condicoes_pagamento?: string | null
          created_at?: string | null
          fator_nacionalizacao?: string | null
          frase_comissao?: string | null
          frase_preco?: string | null
          garantia?: string | null
          id?: string
          imposto_icms?: string | null
          imposto_ipi?: string | null
          nome: string
          prazo_entrega?: string | null
          status?: string
          transporte_seguro?: string | null
          treinamento_tecnico?: string | null
          updated_at?: string | null
          validade_oferta?: string | null
        }
        Update: {
          aplicar_fator_nac?: boolean
          assistencia_tecnica?: string | null
          atualizado_por?: string | null
          campos_adicionais?: Json
          comissao?: number | null
          condicoes_pagamento?: string | null
          created_at?: string | null
          fator_nacionalizacao?: string | null
          frase_comissao?: string | null
          frase_preco?: string | null
          garantia?: string | null
          id?: string
          imposto_icms?: string | null
          imposto_ipi?: string | null
          nome?: string
          prazo_entrega?: string | null
          status?: string
          transporte_seguro?: string | null
          treinamento_tecnico?: string | null
          updated_at?: string | null
          validade_oferta?: string | null
        }
        Relationships: []
      }
      versao_imagens: {
        Row: {
          criada_em: string
          id: string
          nome_arquivo: string | null
          url: string
          versao_id: string
        }
        Insert: {
          criada_em?: string
          id?: string
          nome_arquivo?: string | null
          url: string
          versao_id: string
        }
        Update: {
          criada_em?: string
          id?: string
          nome_arquivo?: string | null
          url?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "versao_imagens_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      versao_tipos_proposta: {
        Row: {
          created_at: string
          tipo_proposta_id: string
          versao_id: string
        }
        Insert: {
          created_at?: string
          tipo_proposta_id: string
          versao_id: string
        }
        Update: {
          created_at?: string
          tipo_proposta_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "versao_tipos_proposta_tipo_proposta_id_fkey"
            columns: ["tipo_proposta_id"]
            isOneToOne: false
            referencedRelation: "tipos_proposta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versao_tipos_proposta_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      versoes: {
        Row: {
          acessorios_standards: string | null
          alerta_estoque_minimo: number | null
          atualizado_por: string | null
          caracteristicas_construtivas: string | null
          categoria_id: string | null
          cod_erp: string | null
          created_at: string | null
          data_ultimo_reajuste: string | null
          deleted_at: string | null
          deleted_by: string | null
          desconto_max_bener: number
          desconto_max_representante: number
          especificacoes_tecnicas: string | null
          estoque_bloqueado: number
          estoque_disponivel: number
          estoque_reservado: number
          estoque_total: number
          fator_nac: number
          galeria: Json | null
          id: string
          imagem_preview: string | null
          modelo: string | null
          moeda: string
          nome: string
          nome_abreviado: string | null
          reg: string | null
          status: string
          tem_estoque: boolean
          tem_fator: boolean
          tipos_proposta: Json
          updated_at: string | null
          valor: number
          valor_anterior: number | null
        }
        Insert: {
          acessorios_standards?: string | null
          alerta_estoque_minimo?: number | null
          atualizado_por?: string | null
          caracteristicas_construtivas?: string | null
          categoria_id?: string | null
          cod_erp?: string | null
          created_at?: string | null
          data_ultimo_reajuste?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          desconto_max_bener?: number
          desconto_max_representante?: number
          especificacoes_tecnicas?: string | null
          estoque_bloqueado?: number
          estoque_disponivel?: number
          estoque_reservado?: number
          estoque_total?: number
          fator_nac?: number
          galeria?: Json | null
          id?: string
          imagem_preview?: string | null
          modelo?: string | null
          moeda?: string
          nome: string
          nome_abreviado?: string | null
          reg?: string | null
          status?: string
          tem_estoque?: boolean
          tem_fator?: boolean
          tipos_proposta?: Json
          updated_at?: string | null
          valor?: number
          valor_anterior?: number | null
        }
        Update: {
          acessorios_standards?: string | null
          alerta_estoque_minimo?: number | null
          atualizado_por?: string | null
          caracteristicas_construtivas?: string | null
          categoria_id?: string | null
          cod_erp?: string | null
          created_at?: string | null
          data_ultimo_reajuste?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          desconto_max_bener?: number
          desconto_max_representante?: number
          especificacoes_tecnicas?: string | null
          estoque_bloqueado?: number
          estoque_disponivel?: number
          estoque_reservado?: number
          estoque_total?: number
          fator_nac?: number
          galeria?: Json | null
          id?: string
          imagem_preview?: string | null
          modelo?: string | null
          moeda?: string
          nome?: string
          nome_abreviado?: string | null
          reg?: string | null
          status?: string
          tem_estoque?: boolean
          tem_fator?: boolean
          tipos_proposta?: Json
          updated_at?: string | null
          valor?: number
          valor_anterior?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "versoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "versoes_modelo_fkey"
            columns: ["modelo"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      versoes_historico: {
        Row: {
          acao: string | null
          created_at: string | null
          detalhes: string | null
          id: string
          usuario: string | null
          versao_id: string | null
        }
        Insert: {
          acao?: string | null
          created_at?: string | null
          detalhes?: string | null
          id?: string
          usuario?: string | null
          versao_id?: string | null
        }
        Update: {
          acao?: string | null
          created_at?: string | null
          detalhes?: string | null
          id?: string
          usuario?: string | null
          versao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "versoes_historico_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "versoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      categorias_produtos: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          logo: string | null
          nome: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          logo?: string | null
          nome?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          logo?: string | null
          nome?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_user_access_categoria: { Args: { cat_id: string }; Returns: boolean }
      extranet_rd_claim_project: {
        Args: { p_execution: string; p_project_id: string }
        Returns: Json
      }
      extranet_rd_finish_project: {
        Args: {
          p_deal_id: string
          p_execution: string
          p_project_id: string
          p_proposal_id: string
          p_snapshot: Json
        }
        Returns: Json
      }
      extranet_rd_remember_deal: {
        Args: { p_deal_id: string; p_execution: string; p_project_id: string }
        Returns: Json
      }
      generate_next_proposta_numero: {
        Args: { is_licitacao: boolean }
        Returns: string
      }
      get_access_logs: {
        Args: { days_limit?: number }
        Returns: {
          created_at: string
          id: string
          ip_address: string
          updated_at: string
          user_agent: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_current_user_allowed_categoria_ids: {
        Args: never
        Returns: {
          categoria_id: string
        }[]
      }
      get_inactive_representantes: {
        Args: { days?: number }
        Returns: {
          dias_sem_proposta: number
          nome: string
          razao_social: string
          representante_id: string
          total_propostas: number
          ultima_proposta_em: string
        }[]
      }
      get_user_estado_atuacao: { Args: never; Returns: string }
      get_user_estados_atuacao: { Args: never; Returns: string[] }
      get_users_online_last_days: {
        Args: { days_limit?: number }
        Returns: {
          avatar_url: string
          email: string
          id: string
          is_online_today: boolean
          last_access: string
          name: string
          role: string
          setor: string
          status: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_completo: { Args: never; Returns: boolean }
      is_competitividade_ativada: { Args: never; Returns: boolean }
      is_gerente: { Args: never; Returns: boolean }
      is_vendedor_ou_representante: { Args: never; Returns: boolean }
      touch_last_seen: { Args: never; Returns: string }
      touch_user_activity: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const


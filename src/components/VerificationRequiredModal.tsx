'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, ExternalLink, Mail, MessageCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import { ThemedButton } from '@/components/ui/themed'
import TelegramConnectionModal from './TelegramConnectionModal'
import { useAuth } from '@/components/providers/auth-provider'

interface VerificationRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  actionName?: string // Hangi işlem için gerekli (örn: "ürün satın almak", "etkinliğe katılmak")
}

export default function VerificationRequiredModal({
  isOpen,
  onClose,
  onSuccess,
  actionName = "bu işlemi gerçekleştirmek"
}: VerificationRequiredModalProps) {
  const { theme } = useUserTheme()
  const { user, refreshUser } = useAuth()
  const [showTelegramModal, setShowTelegramModal] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const telegramConnected = !!user?.telegramId
  const emailVerified = !!user?.emailVerified

  // Her iki doğrulama da tamamlandıysa modal'ı kapat
  useEffect(() => {
    if (isOpen && telegramConnected && emailVerified) {
      toast.success('Tüm doğrulamalar tamamlandı!')
      onClose()
      onSuccess?.()
    }
  }, [isOpen, telegramConnected, emailVerified, onClose, onSuccess])

  async function sendVerificationEmail() {
    if (sendingVerification || verificationSent) return

    setSendingVerification(true)
    try {
      const res = await fetch('/api/user/send-verification-email', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()

      if (res.ok) {
        setVerificationSent(true)
        toast.success('Doğrulama e-postası gönderildi! Lütfen e-postanızı kontrol edin.')
      } else {
        toast.error(data.error || 'E-posta gönderilemedi')
      }
    } catch (error) {
      toast.error('Bir hata oluştu')
    } finally {
      setSendingVerification(false)
    }
  }

  function handleTelegramSuccess() {
    setShowTelegramModal(false)
    refreshUser()
  }

  const allVerified = telegramConnected && emailVerified
  const needsTelegram = !telegramConnected
  const needsEmail = !emailVerified

  return (
    <>
      <Dialog open={isOpen && !showTelegramModal} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
          style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.cardBorder,
            color: theme.colors.text
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="text-xl font-bold text-center flex items-center justify-center gap-2"
              style={{ color: theme.colors.text }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: theme.colors.warning }} />
              Doğrulama Gerekli
            </DialogTitle>
            <DialogDescription style={{ color: theme.colors.textMuted }} className="text-center">
              {actionName} için aşağıdaki doğrulamaları tamamlamanız gerekmektedir.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Telegram Doğrulama */}
            <Card
              className="p-4"
              style={{
                background: telegramConnected
                  ? `linear-gradient(to bottom right, ${theme.colors.success}10, ${theme.colors.success}05)`
                  : `linear-gradient(to bottom right, ${theme.colors.error}10, ${theme.colors.error}05)`,
                borderColor: telegramConnected ? `${theme.colors.success}40` : `${theme.colors.error}40`
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: telegramConnected
                        ? `${theme.colors.success}20`
                        : `${theme.colors.error}20`
                    }}
                  >
                    <MessageCircle
                      className="w-5 h-5"
                      style={{ color: telegramConnected ? theme.colors.success : theme.colors.error }}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                      Telegram Bağlantısı
                    </h4>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                      {telegramConnected ? 'Telegram bağlı' : 'Telegram bağlı değil'}
                    </p>
                  </div>
                </div>
                {telegramConnected ? (
                  <CheckCircle2 className="w-6 h-6" style={{ color: theme.colors.success }} />
                ) : (
                  <ThemedButton
                    onClick={() => setShowTelegramModal(true)}
                    variant="primary"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Bağla
                  </ThemedButton>
                )}
              </div>
            </Card>

            {/* Email Doğrulama */}
            <Card
              className="p-4"
              style={{
                background: emailVerified
                  ? `linear-gradient(to bottom right, ${theme.colors.success}10, ${theme.colors.success}05)`
                  : `linear-gradient(to bottom right, ${theme.colors.error}10, ${theme.colors.error}05)`,
                borderColor: emailVerified ? `${theme.colors.success}40` : `${theme.colors.error}40`
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: emailVerified
                        ? `${theme.colors.success}20`
                        : `${theme.colors.error}20`
                    }}
                  >
                    <Mail
                      className="w-5 h-5"
                      style={{ color: emailVerified ? theme.colors.success : theme.colors.error }}
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                      E-posta Doğrulaması
                    </h4>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                      {emailVerified ? 'E-posta doğrulandı' : 'E-posta doğrulanmadı'}
                    </p>
                  </div>
                </div>
                {emailVerified ? (
                  <CheckCircle2 className="w-6 h-6" style={{ color: theme.colors.success }} />
                ) : verificationSent ? (
                  <span
                    className="text-sm font-medium px-3 py-1 rounded-lg"
                    style={{
                      backgroundColor: `${theme.colors.warning}20`,
                      color: theme.colors.warning
                    }}
                  >
                    E-posta gönderildi
                  </span>
                ) : (
                  <ThemedButton
                    onClick={sendVerificationEmail}
                    variant="primary"
                    size="sm"
                    disabled={sendingVerification}
                  >
                    {sendingVerification ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Gönderiliyor
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-1" />
                        Doğrula
                      </>
                    )}
                  </ThemedButton>
                )}
              </div>
            </Card>

            {/* Bilgi notu */}
            <div
              className="p-3 rounded-lg text-sm text-center"
              style={{
                backgroundColor: `${theme.colors.primary}10`,
                color: theme.colors.textSecondary
              }}
            >
              {needsTelegram && needsEmail ? (
                'Hem Telegram bağlantısını hem de e-posta doğrulamasını tamamlayın.'
              ) : needsTelegram ? (
                'Telegram hesabınızı bağlayarak devam edebilirsiniz.'
              ) : needsEmail ? (
                'E-posta adresinizi doğrulayarak devam edebilirsiniz.'
              ) : (
                'Tüm doğrulamalar tamamlandı!'
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <ThemedButton
              onClick={onClose}
              variant="secondary"
              size="md"
            >
              Kapat
            </ThemedButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Telegram Modal */}
      <TelegramConnectionModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
        onSuccess={handleTelegramSuccess}
      />
    </>
  )
}

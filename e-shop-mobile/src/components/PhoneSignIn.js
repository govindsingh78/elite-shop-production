import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, Notice, Row, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { colors } from "@/theme";

/** Keeps digits, spaces, + and - while typing a phone number. */
const cleanPhone = (value) => value.replace(/[^\d+\s-]/g, "").slice(0, 16);
/** Keeps the 6 digits of a code (pasted codes often come with spaces). */
const cleanCode = (value) => value.replace(/\D/g, "").slice(0, 6);
const digits = (value) => value.replace(/\D/g, "");
const localNumber = (phone) => (phone || "").replace(/^\+91\s*/, "");

/** Seconds left before another code can be sent, counting down; set it to start. */
function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, setSeconds];
}

const codeInputStyle = { fontSize: 20, letterSpacing: 8 };

function TextLink({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      <T variant="strong" color={disabled ? colors.faint : colors.tealDark}>{label}</T>
    </Pressable>
  );
}

/**
 * Signing in with a mobile number: a code is sent by SMS, then typed (or filled in from the SMS). `onSignedIn`
 * gets the new session. Give it `key={portal}` so changing portal starts again.
 */
export function OtpSignIn({ portal, onSignedIn, disabled }) {
  const { signInWithCode } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendIn, setResendIn] = useCountdown();

  const send = async () => {
    if (digits(phone).length < 10) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/otp/send", { method: "POST", body: { portal, phone } });
      setNotice(result.message);
      setResendIn(result.resend_in || 30);
      setCode("");
      setStep("code");
    } catch (sendError) {
      setError(sendError.message);
      if (sendError.retryAfter && sendError.retryAfter < 120) setResendIn(sendError.retryAfter);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onSignedIn(await signInWithCode(portal, phone, code));
    } catch (verifyError) {
      setError(verifyError.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (step === "phone") {
    return (
      <View>
        {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
        <TextField
          label="Mobile number"
          icon="call-outline"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="98765 43210"
          hint="We’ll text you a 6-digit code. It works for numbers you’ve confirmed in Password & sign-in."
          value={phone}
          onChangeText={(text) => setPhone(cleanPhone(text))}
          onSubmitEditing={send}
        />
        <Button title={resendIn > 0 ? `Send code (${resendIn}s)` : "Send code"} icon="chatbubble-ellipses-outline" loading={busy} disabled={disabled || resendIn > 0} onPress={send} />
      </View>
    );
  }

  return (
    <View>
      {notice ? <Notice tone="success" message={notice} style={{ marginBottom: 14 }} /> : null}
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
      <TextField
        label="6-digit code"
        icon="keypad-outline"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        placeholder="••••••"
        inputStyle={codeInputStyle}
        value={code}
        onChangeText={(text) => setCode(cleanCode(text))}
        onSubmitEditing={verify}
      />
      <Button title="Verify & sign in" icon="log-in-outline" loading={busy} disabled={disabled} onPress={verify} />
      <Row justify="space-between" style={{ marginTop: 14 }}>
        <TextLink label="Change number" onPress={() => { setStep("phone"); setError(""); }} />
        <TextLink label={resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"} onPress={send} disabled={busy || resendIn > 0} />
      </Row>
    </View>
  );
}

/**
 * "Sign in with your mobile number" in Password & sign-in: confirm a number with a code sent to it so it can be
 * used to sign in, or turn that off. Hidden until the store can send SMS codes.
 */
export function PhoneSignInCard({ style }) {
  const { request } = useAuth();
  const toast = useToast();
  const [state, setState] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useCountdown();

  const load = useCallback(() => {
    request("/account/phone")
      .then((result) => {
        setState(result);
        setPhone(localNumber(result.phone));
      })
      .catch(() => setState(null));
  }, [request]);

  useEffect(() => { load(); }, [load]);

  if (!state?.available) return null;

  const send = async () => {
    if (digits(phone).length < 10) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await request("/account/phone/send", { method: "POST", body: { phone } });
      toast(result.message, "info");
      setCodeSent(true);
      setCode("");
      setResendIn(result.resend_in || 30);
    } catch (sendError) {
      setError(sendError.message);
      if (sendError.retryAfter && sendError.retryAfter < 120) setResendIn(sendError.retryAfter);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await request("/account/phone/verify", { method: "POST", body: { phone, code } });
      toast(result.message);
      setState(result);
      setEditing(false);
      setCodeSent(false);
    } catch (confirmError) {
      setError(confirmError.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = () => confirmAction({
    title: "Stop signing in with your number?",
    message: "You can turn it on again any time. The number stays on your account for deliveries.",
    confirmLabel: "Turn off",
    onConfirm: async () => {
      try {
        const result = await request("/account/phone", { method: "DELETE" });
        toast(result.message);
        setState(result);
      } catch (offError) {
        toast(offError.message, "error");
      }
    },
  });

  const cancel = () => {
    setCodeSent(false);
    setEditing(false);
    setError("");
    load();
  };

  return (
    <Card style={style}>
      <Row gap={10} align="flex-start" style={{ marginBottom: 12 }}>
        <Ionicons name="phone-portrait-outline" size={22} color={colors.tealDark} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <T variant="h3">Sign in with your mobile number</T>
          <T variant="small" style={{ marginTop: 2 }}>
            {state.verified && !editing ? `${state.phone} can be used to sign in with a code sent by SMS.` : "Confirm your number once, then sign in with a 6-digit code sent by SMS instead of your password."}
          </T>
        </View>
      </Row>

      {state.verified && !editing ? (
        <Row justify="space-between">
          <TextLink label="Use a different number" onPress={() => { setEditing(true); setPhone(""); }} />
          <Pressable onPress={turnOff} hitSlop={8}><T variant="strong" color={colors.danger}>Turn off</T></Pressable>
        </Row>
      ) : (
        <View>
          {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
          <TextField label="Mobile number" icon="call-outline" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="98765 43210" value={phone} editable={!codeSent} onChangeText={(text) => setPhone(cleanPhone(text))} />
          {codeSent ? (
            <TextField label="6-digit code" icon="keypad-outline" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} autoFocus placeholder="••••••" inputStyle={codeInputStyle} value={code} onChangeText={(text) => setCode(cleanCode(text))} onSubmitEditing={confirm} />
          ) : null}
          {codeSent
            ? <Button title="Confirm number" icon="checkmark-circle-outline" loading={busy} onPress={confirm} />
            : <Button title={resendIn > 0 ? `Send code (${resendIn}s)` : "Send code"} icon="chatbubble-ellipses-outline" loading={busy} disabled={resendIn > 0} onPress={send} />}
          {codeSent || editing ? (
            <Row justify="space-between" style={{ marginTop: 14 }}>
              <TextLink label="Cancel" onPress={cancel} />
              {codeSent ? <TextLink label={resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"} onPress={send} disabled={busy || resendIn > 0} /> : null}
            </Row>
          ) : null}
        </View>
      )}
    </Card>
  );
}

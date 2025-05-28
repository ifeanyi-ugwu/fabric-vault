import { useNavigate } from "@tanstack/react-router"
import { useState, type ChangeEvent, type FormEvent } from "react"

import { useIdentity } from "~/contexts/identity"

export function useAddIdentity() {
  const navigate = useNavigate()
  const { addIdentity } = useIdentity()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [certificateFileContent, setCertificateFileContent] = useState<
    string | null
  >(null)

  const handleCertificateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCertificateFileContent(e.target?.result as string | null)
      }
      reader.onerror = () => {
        setErrorMessage("Failed to read the certificate file.")
        setCertificateFileContent(null)
      }
      reader.readAsText(file)
    }
  }

  /**
   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setErrorMessage(null);

  const formData = new FormData(e.target as HTMLFormElement);

  const label = formData.get("label") as string | null;
  const organization = formData.get("organization") as string | null;
  const certificateFile = formData.get("certificate") as File | null;
  const privateKeyPEM = formData.get("privateKey") as string | null;

  if (!label || !privateKeyPEM || !certificateFile || !organization) {
    setErrorMessage("Please fill in all the required fields, including uploading the certificate.");
    return;
  }

  if (typeof label !== "string" || typeof privateKeyPEM !== "string" || typeof organization !== "string") {
    setErrorMessage("One or more form values are not valid strings.");
    return;
  }

  try {
    const certificateText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject("Failed to read the certificate file.");
      reader.readAsText(certificateFile);
    });

    // Process Certificate
    const certificateBase64 = certificateText
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s/g, "");
    const certificateUint8Array = base64ToUint8Array(certificateBase64);

    // Process Private Key (as before)
    const privateKeyBase64 = privateKeyPEM
      .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
      .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
      .replace(/\s/g, "");
    const privateKeyUint8Array = base64ToUint8Array(privateKeyBase64);

    await addIdentity(
      { label, certificate: certificateUint8Array, mspId: organization },
      privateKeyUint8Array
    );
    navigate({ to: "/dashboard" });

  } catch (error: any) {
    console.error("Error adding identity:", error);
    setErrorMessage(error.message || "Failed to add identity. Please try again.");
  }
};
   */

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(e.target as HTMLFormElement)

    const label = formData.get("label")
    const organization = formData.get("organization")
    const privateKeyPEM = formData.get("privateKey")

    if (!label || !privateKeyPEM || !certificateFileContent || !organization) {
      setErrorMessage("Please fill in all the required fields")
      return
    }

    if (
      typeof label !== "string" ||
      typeof privateKeyPEM !== "string" ||
      typeof certificateFileContent !== "string" ||
      typeof organization !== "string"
    ) {
      setErrorMessage("Invalid entries")
      return
    }

    try {
      const certificatePEM = certificateFileContent

      await addIdentity(
        { label, certificate: certificatePEM, mspId: organization },
        privateKeyPEM
      )

      navigate({ to: "/dashboard" })
    } catch (error: any) {
      console.error("Error adding identity:", error)
      setErrorMessage(
        error.message || "Failed to add identity. Please try again."
      )
    }
  }

  return {
    handleSubmit,
    handleCertificateChange,
    certificateFileContent,
    errorMessage
  }
}

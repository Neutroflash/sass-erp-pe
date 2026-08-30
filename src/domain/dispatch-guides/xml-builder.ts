import { cdata, formatDate, buildSignatureBlock, UBL_EXTENSIONS_PLACEHOLDER } from "../invoicing/sunat/xml-common";
import type { DispatchGuidePayload } from "./types";

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19); // HH:MM:SS
}

/**
 * UBL DespatchAdvice (formato "2022" de la Guía de Remisión Electrónica) — v1 solo "transporte
 * privado" (modalidad "02" del catálogo 18: el propio remitente traslada, sin transportista
 * contratado) y motivo "venta" (catálogo 20, código fijo en el payload). Estructura reconstruida
 * contra la plantilla oficial de Greenter (`thegreenter/xml`, `despatch2022.xml.twig`) — ver el
 * comentario grande en gre-client.ts sobre por qué esto NO está confirmado en vivo, a diferencia
 * de boletas/facturas/notas.
 *
 * Igual que Invoice/CreditNote/DebitNote: el nodo de firma queda vacío
 * (`UBL_EXTENSIONS_PLACEHOLDER`), `sign.ts` lo completa después — la firma XAdES-BES es agnóstica
 * del tipo de documento UBL.
 */
export function generateDispatchGuideXML(payload: DispatchGuidePayload): string {
  const { emisor, destinatario, lineas } = payload;

  const despatchLines = lineas
    .map(
      (line, i) => `
  <cac:DespatchLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${line.unitCode}">${line.quantity}</cbc:DeliveredQuantity>
    <cac:OrderLineReference>
      <cbc:LineID>${i + 1}</cbc:LineID>
    </cac:OrderLineReference>
    <cac:Item>
      <cbc:Description>${cdata(line.description)}</cbc:Description>
    </cac:Item>
  </cac:DespatchLine>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  ${UBL_EXTENSIONS_PLACEHOLDER}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${payload.serie}-${payload.numero}</cbc:ID>
  <cbc:IssueDate>${formatDate(payload.fechaEmision)}</cbc:IssueDate>
  <cbc:IssueTime>${formatTime(payload.fechaEmision)}</cbc:IssueTime>
  <cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>
  ${buildSignatureBlock(emisor.ruc, emisor.businessName)}
  <cac:DespatchSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(emisor.businessName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${destinatario.documentTypeCode}" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${destinatario.documentNumber}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(destinatario.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>SUNAT_Envio</cbc:ID>
    <cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">${payload.motivoTrasladoCodigo}</cbc:HandlingCode>
    <cbc:GrossWeightMeasure unitCode="KGM">${payload.pesoTotalKg.toFixed(3)}</cbc:GrossWeightMeasure>
    <cac:ShipmentStage>
      <cbc:TransportModeCode listName="Modalidad de traslado" listAgencyName="PE:SUNAT" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">02</cbc:TransportModeCode>
      <cac:TransitPeriod>
        <cbc:StartDate>${formatDate(payload.fechaTraslado)}</cbc:StartDate>
      </cac:TransitPeriod>
      <cac:DriverPerson>
        <cbc:ID schemeID="1" schemeName="Documento de Identidad" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06">${payload.chofer.documentNumber}</cbc:ID>
        <cbc:FirstName>${cdata(payload.chofer.firstName)}</cbc:FirstName>
        <cbc:FamilyName>${cdata(payload.chofer.lastName)}</cbc:FamilyName>
        <cbc:JobTitle>Principal</cbc:JobTitle>
        <cac:IdentityDocumentReference>
          <cbc:ID>${payload.chofer.license}</cbc:ID>
        </cac:IdentityDocumentReference>
      </cac:DriverPerson>
    </cac:ShipmentStage>
    <cac:Delivery>
      <cac:DeliveryAddress>
        <cbc:ID schemeAgencyName="PE:INEI" schemeName="Ubigeos">${payload.destino.ubigeo}</cbc:ID>
        <cac:AddressLine>
          <cbc:Line>${cdata(payload.destino.address)}</cbc:Line>
        </cac:AddressLine>
      </cac:DeliveryAddress>
      <cac:Despatch>
        <cac:DespatchAddress>
          <cbc:ID schemeAgencyName="PE:INEI" schemeName="Ubigeos">${payload.origen.ubigeo}</cbc:ID>
          <cac:AddressLine>
            <cbc:Line>${cdata(payload.origen.address)}</cbc:Line>
          </cac:AddressLine>
        </cac:DespatchAddress>
      </cac:Despatch>
    </cac:Delivery>
    <cac:TransportHandlingUnit>
      <cac:TransportEquipment>
        <cbc:ID>${payload.vehiculoPlaca}</cbc:ID>
      </cac:TransportEquipment>
    </cac:TransportHandlingUnit>
  </cac:Shipment>${despatchLines}
</DespatchAdvice>`;
}

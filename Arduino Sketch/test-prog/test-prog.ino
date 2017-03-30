/* Smart Toilet
 *  Toilet Management Syatem
 *  Author: MD. KHAIRUL ALAM TAIFUR
 *  Date: 15 March 2017
 */

#include"Arduino.h"
#include"AirQuality.h"
#include "dht.h"
#include "Ultrasonic.h"

AirQuality airqualitysensor;
int current_quality =-1;
int air_quality = 0;
int water = 50;
dht DHT;

#define DHT11_PIN 5 //thmp and humid sensor to pin D5
#define AIR_PIN A1 // Air quality sensor to pin A1
#define BUZZER_PIN 6 // Buzzer to pin D6

Ultrasonic ultrasonic(7); //ultrasonic sensor to pin D7

float temperature = 0; 
int humidity = 0;
int distance = 0;

String measurement = " ";

void setup() 
{
    Serial.begin(9600); //serial connection for terminal
    Serial1.begin(57600); //serial port sending data to MPU unit
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(WATER_SENSOR, INPUT_PULLUP);
    Serial.println("DHT TEST PROGRAM ");
    Serial.print("LIBRARY VERSION: ");
    Serial.println(DHT_LIB_VERSION);
    Serial.println("Type,\tstatus,\tHumidity (%),\tTemperature (C)");
    airqualitysensor.init(14);
}

void loop(){
  air_quality_test();
  ultrasonic_cm();
  temperature_humidity();
  tone(BUZZER_PIN, 2000, 500);
  send_to_linkit(); //we are sending data every 2s from mcu to mpu
  delay(2000);
  }

//this function read temperature and humidity from the DHT11 sensor
void temperature_humidity(){
  // READ DATA
  Serial.print("DHT11, \t");
  int chk = DHT.read11(DHT11_PIN);
  if(chk) return; // to see the error comment this line and uncomment following block
  /*
  switch (chk)
  {
    case DHTLIB_OK:  
    Serial.print("OK,\t"); 
    break;
    case DHTLIB_ERROR_CHECKSUM: 
    Serial.print("Checksum error,\t"); 
    break;
    case DHTLIB_ERROR_TIMEOUT: 
    Serial.print("Time out error,\t"); 
    break;
    case DHTLIB_ERROR_CONNECT:
        Serial.print("Connect error,\t");
        break;
    case DHTLIB_ERROR_ACK_L:
        Serial.print("Ack Low error,\t");
        break;
    case DHTLIB_ERROR_ACK_H:
        Serial.print("Ack High error,\t");
        break;
    default: 
    Serial.print("Unknown error,\t"); 
    break;
  }
  */
  // DISPLAY DATA to the arduino serial terminal
  Serial.print(DHT.humidity, 1);
  humidity = DHT.humidity;
  Serial.print(",\t");
  Serial.println(DHT.temperature, 1);
  temperature = DHT.temperature;
}

//this function test air quality
void air_quality_test(){
  current_quality=airqualitysensor.slope();
    if (current_quality >= 0)// if a valid data returned.
    {   air_quality = current_quality; //we are sending the value (1, 2 or 3) to MPU
        if (current_quality==0)
            Serial.println("High pollution! Force signal active");
        else if (current_quality==1)
            Serial.println("High pollution!");
        else if (current_quality==2)
            Serial.println("Low pollution!");
        else if (current_quality ==3)
            Serial.println("Fresh air");
    }
  }
//interrupt service routine to read air quality sensor
ISR(TIMER1_OVF_vect)
{
  if(airqualitysensor.counter==61)//set 2 seconds as a detected duty
  {

      airqualitysensor.last_vol=airqualitysensor.first_vol;
      airqualitysensor.first_vol=analogRead(AIR_PIN);
      airqualitysensor.counter=0;
      airqualitysensor.timer_index=1;
      PORTB=PORTB^0x20;
  }
  else
  {
    airqualitysensor.counter++;
  }
}

void ultrasonic_cm(){
  //long RangeInInches;
  long RangeInCentimeters;
  //to see the data in inch uncomment the following block.
  /*
  Serial.println("The distance to obstacles in front is: ");
  RangeInInches = ultrasonic.MeasureInInches();
  Serial.print(RangeInInches);//0~157 inches
  Serial.println(" inch");
  delay(250);
  */
  RangeInCentimeters = ultrasonic.MeasureInCentimeters(); // two measurements should keep an interval
  distance = RangeInCentimeters;
  Serial.print("Distance = ");//0~400cm
  Serial.print(RangeInCentimeters);//0~400cm
  Serial.println(" cm");
  delay(250);
  }

//this function sends data from MCU to MPU using serial port.
//we are sending all the data in a single string and then seperated 
//in the MPU using node.js
void send_to_linkit(){
   //+= is used to add the value to measurement string
   measurement += temperature;
   measurement += " ";
   measurement += humidity;
   measurement += " ";
   measurement += air_quality;
   measurement += " ";
   measurement += distance;
   measurement += " ";
   measurement += water;
   measurement += " ";
   Serial1.println(measurement);
   measurement = " "; //measurement string is null here     
  }
